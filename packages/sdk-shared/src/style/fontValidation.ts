import { isSafeFontUrl } from './fonts';

import type { FontDisplay, FontFace, FontStyle, SpaceFont } from '../types/StyleTypes';

/**
 * Turns whatever arrived into a manifest entry, or says why it cannot.
 *
 * Every writer of the manifest goes through here — the GraphQL mutation the builder calls, the MCP tool an agent
 * calls, the importer that reads somebody else's CSS. What they send is JSON: a shape nobody checked, holding
 * strings that end up in a `<link href>` and inside a `@font-face`. The resolver escapes what it writes, and this
 * is the other half — the part that decides a value had no business being stored at all.
 *
 * Written by hand rather than with a schema library on purpose: this module is reachable from the SDK's own style
 * barrel, and a runtime that renders a page should not carry a validator's dependency to do it.
 */
const FONT_SOURCES = new Set(['system', 'google', 'remote', 'hosted']);
const FONT_DISPLAYS = new Set(['auto', 'block', 'swap', 'fallback', 'optional']);
const FONT_FORMATS = new Set(['woff2', 'woff']);
const MAX_FAMILY_LENGTH = 100;

/** No place in a family name, and each one a way to smuggle a line break into a declaration. Tested by code point
 *  rather than by a regular expression, which would have to hold the control characters themselves to say so. */
const hasControlCharacter = (value: string): boolean => {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) {
      return true;
    }
  }

  return false;
};

export class FontValidationError extends Error {}

const fail = (message: string): never => {
  throw new FontValidationError(message);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseFamily = (value: unknown): string => {
  if (typeof value !== 'string') {
    return fail('font.family must be a string');
  }

  const family = value.trim();
  if (!family) {
    return fail('font.family cannot be empty');
  }

  if (family.length > MAX_FAMILY_LENGTH) {
    return fail(`font.family cannot be longer than ${MAX_FAMILY_LENGTH} characters`);
  }

  if (hasControlCharacter(family)) {
    return fail('font.family cannot contain control characters');
  }

  return family;
};

const parseWeights = (value: unknown): number[] => {
  if (value === undefined) {
    return [400];
  }

  if (!Array.isArray(value) || value.length === 0) {
    return fail('font.weights must be a non-empty list of numbers');
  }

  const weights = (value as unknown[]).map<number>(weight => {
    if (typeof weight !== 'number' || !Number.isInteger(weight) || weight < 1 || weight > 1000) {
      return fail('font.weights must hold whole numbers between 1 and 1000');
    }

    return weight;
  });

  return [...new Set(weights)].sort((a, b) => a - b);
};

const parseStyles = (value: unknown): FontStyle[] => {
  if (value === undefined) {
    return ['normal'];
  }

  if (!Array.isArray(value) || value.length === 0) {
    return fail('font.styles must be a non-empty list');
  }

  const styles = (value as unknown[]).map<FontStyle>(style => {
    if (style !== 'normal' && style !== 'italic') {
      return fail('font.styles may only hold "normal" or "italic"');
    }

    return style;
  });

  return [...new Set(styles)];
};

const parseFace = (value: unknown, index: number): FontFace => {
  if (!isRecord(value)) {
    return fail(`font.files[${index}] must be an object`);
  }

  const { weight, style, format, unicodeRange } = value;
  if (typeof weight !== 'number' || !Number.isInteger(weight) || weight < 1 || weight > 1000) {
    return fail(`font.files[${index}].weight must be a whole number between 1 and 1000`);
  }

  if (style !== 'normal' && style !== 'italic') {
    return fail(`font.files[${index}].style must be "normal" or "italic"`);
  }

  if (typeof format !== 'string' || !FONT_FORMATS.has(format)) {
    return fail(`font.files[${index}].format must be "woff2" or "woff"`);
  }

  const face: FontFace = { weight, style, format: format as FontFace['format'] };
  if (unicodeRange !== undefined) {
    if (typeof unicodeRange !== 'string') {
      return fail(`font.files[${index}].unicodeRange must be a string`);
    }

    face.unicodeRange = unicodeRange;
  }

  return face;
};

/** A store-relative path, which is the only thing a hosted font may name — see `HostedFont`. */
const parsePath = (value: unknown, index: number): string => {
  if (typeof value !== 'string' || !value) {
    return fail(`font.files[${index}].path must be a non-empty string`);
  }

  if (value.includes('://') || value.startsWith('/')) {
    return fail(`font.files[${index}].path must be relative to the font store, not a URL`);
  }

  if (value.split('/').includes('..')) {
    return fail(`font.files[${index}].path cannot climb out of the font store`);
  }

  return value;
};

const parseFiles = (value: unknown): unknown[] => {
  if (!Array.isArray(value) || value.length === 0) {
    return fail('font.files must be a non-empty list');
  }

  return value;
};

/**
 * Parses and normalizes a manifest entry. Throws {@link FontValidationError} with a message meant to be read by
 * whoever sent the value — a person in the Fonts panel, or an agent that will try again.
 */
export const parseSpaceFont = (value: unknown): SpaceFont => {
  if (!isRecord(value)) {
    return fail('a font must be an object');
  }

  const { source, fallback, display, preload } = value;
  if (typeof source !== 'string' || !FONT_SOURCES.has(source)) {
    return fail('font.source must be one of: system, google, remote, hosted');
  }

  if (typeof fallback !== 'string' || !fallback.trim()) {
    return fail('font.fallback is required: it is what renders until the face arrives');
  }

  if (display !== undefined && (typeof display !== 'string' || !FONT_DISPLAYS.has(display))) {
    return fail('font.display must be one of: auto, block, swap, fallback, optional');
  }

  if (preload !== undefined && typeof preload !== 'boolean') {
    return fail('font.preload must be a boolean');
  }

  const base = {
    family: parseFamily(value.family),
    fallback: fallback.trim(),
    weights: parseWeights(value.weights),
    styles: parseStyles(value.styles),
    ...(display === undefined ? {} : { display: display as FontDisplay }),
    ...(preload === undefined ? {} : { preload })
  };

  if (source === 'system') {
    return { ...base, source: 'system' };
  }

  if (source === 'google') {
    const { subsets } = value;
    if (subsets !== undefined && (!Array.isArray(subsets) || subsets.some(item => typeof item !== 'string'))) {
      return fail('font.subsets must be a list of strings');
    }

    return { ...base, source: 'google', ...(subsets === undefined ? {} : { subsets: subsets as string[] }) };
  }

  if (source === 'remote') {
    const { stylesheet, files } = value;
    if (stylesheet === undefined && files === undefined) {
      return fail('a remote font needs either a stylesheet URL or the font files themselves');
    }

    if (stylesheet !== undefined) {
      if (typeof stylesheet !== 'string' || !isSafeFontUrl(stylesheet)) {
        return fail('font.stylesheet must be an https URL with no credentials in it');
      }

      return { ...base, source: 'remote', stylesheet };
    }

    return {
      ...base,
      source: 'remote',
      files: parseFiles(files).map((file, index) => {
        const face = parseFace(file, index);
        const { url } = file as Record<string, unknown>;
        if (typeof url !== 'string' || !isSafeFontUrl(url)) {
          return fail(`font.files[${index}].url must be an https URL with no credentials in it`);
        }

        return { ...face, url };
      })
    };
  }

  return {
    ...base,
    source: 'hosted',
    files: parseFiles(value.files).map((file, index) => ({
      ...parseFace(file, index),
      path: parsePath((file as Record<string, unknown>).path, index)
    }))
  };
};
