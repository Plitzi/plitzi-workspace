import { createHash } from 'node:crypto';

import type { IconFace, IconGlyphs } from './glyphs';
import type { OfflineDataRaw } from '@plitzi/sdk-shared';

/** Where a space's own icon faces are served: `/_plitzi/icons/<hash>-<face>.woff2`. */
export const ICONS_PATH = '/_plitzi/icons/';

/** One face cut to the glyphs a space names. */
export type SpaceIconFace = IconFace & { codepoints: number[]; href: string };

/** The icons a space names, as faces of their own: what the page's head declares after the whole font's. */
export type SpaceIcons = { hash: string; faces: SpaceIconFace[] };

// A string of the document, as JSON writes it; and in it, the classes an icon is written with.
const JSON_STRING = /"(?:[^"\\]|\\.)*"/g;
const ICON_TOKEN = /\b(?:far|fas|fab|fa-(?:regular|solid|brands)|fa-[a-z0-9]+(?:-[a-z0-9]+)*)\b/g;
const STYLE_OF: Record<string, IconFace['key']> = {
  far: 'regular',
  'fa-regular': 'regular',
  fas: 'solid',
  'fa-solid': 'solid',
  fab: 'brands',
  'fa-brands': 'brands'
};

/**
 * Each icon a text names, with the face its style class before it says — `far fa-heart` is the regular face's, `fa-check`
 * alone the solid one's (Font Awesome's default) — and a brand's always its own.
 */
const namedIcons = (text: string, glyphs: IconGlyphs): Record<IconFace['key'], Set<number>> => {
  const faces: Record<IconFace['key'], Set<number>> = { solid: new Set(), regular: new Set(), brands: new Set() };
  for (const [literal] of text.matchAll(JSON_STRING)) {
    let style: IconFace['key'] = 'solid';
    for (const [token] of literal.matchAll(ICON_TOKEN)) {
      const named = STYLE_OF[token] as IconFace['key'] | undefined;
      if (named) {
        style = named;
        continue;
      }

      const codepoint = glyphs.codepoints.get(token);
      if (codepoint !== undefined) {
        faces[glyphs.brands.has(token) ? 'brands' : style === 'brands' ? 'solid' : style].add(codepoint);
      }
    }
  }

  return faces;
};

const digest = (text: string): string => createHash('sha256').update(text).digest('base64url').slice(0, 16);

const found = new WeakMap<OfflineDataRaw['schema'], SpaceIcons | null>();

/**
 * The glyphs a space names anywhere in its document — an attribute, a component's props, a binding's template, a flow's
 * params: `'fas fa-check'` and both sides of `open ? 'fa-chevron-up' : 'fa-chevron-down'` alike. An icon named only by
 * data the space reads at run time is not here, and needs nothing: the whole font is declared before these faces, so
 * the browser draws a glyph these lack from it.
 */
export const spaceIconsOf = (offlineData: OfflineDataRaw, glyphs: IconGlyphs): SpaceIcons | undefined => {
  // Once per document: the adapters hand every request the same schema until the space changes.
  const known = found.get(offlineData.schema);
  if (known !== undefined) {
    return known ?? undefined;
  }

  const icons = iconsIn(JSON.stringify(offlineData.schema), glyphs);
  found.set(offlineData.schema, icons ?? null);

  return icons;
};

const iconsIn = (text: string, glyphs: IconGlyphs): SpaceIcons | undefined => {
  const named = namedIcons(text, glyphs);
  const cut = glyphs.faces.flatMap(face => {
    const codepoints = [...named[face.key]].sort((a, b) => a - b);

    return codepoints.length > 0 ? [{ ...face, codepoints }] : [];
  });
  if (cut.length === 0) {
    return undefined;
  }

  const hash = digest(cut.map(face => `${face.key}:${face.codepoints.join(',')}`).join(';'));

  return { hash, faces: cut.map(face => ({ ...face, href: `${ICONS_PATH}${hash}-${face.key}.woff2` })) };
};

const hex = (codepoint: number): string => codepoint.toString(16).toUpperCase();

/** The codepoints (sorted) as a `unicode-range`, a run of consecutive ones written as one: `U+F00C-F00E`. */
const unicodeRange = (codepoints: number[]): string => {
  const runs: [number, number][] = [];
  for (const codepoint of codepoints) {
    const last = runs.at(-1);
    if (last && codepoint === last[1] + 1) {
      last[1] = codepoint;
    } else {
      runs.push([codepoint, codepoint]);
    }
  }

  return runs.map(([from, to]) => (from === to ? `U+${hex(from)}` : `U+${hex(from)}-${hex(to)}`)).join(',');
};

/**
 * The faces as the head declares them. Declared after the whole font's, a face with a `unicode-range` is the one a
 * glyph in its range is drawn from: the page fetches the space's few glyphs, not the whole font.
 */
export const iconFacesCss = (icons: SpaceIcons): string =>
  icons.faces
    .map(
      face =>
        `@font-face{font-family:"${face.family}";font-style:normal;font-weight:${face.weight};font-display:block;` +
        `src:url(${face.href}) format("woff2");unicode-range:${unicodeRange(face.codepoints)}}`
    )
    .join('');
