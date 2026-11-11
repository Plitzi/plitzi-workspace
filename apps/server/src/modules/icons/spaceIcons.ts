import { createHash } from 'node:crypto';

import type { IconFace, IconGlyphs } from './glyphs';
import type { OfflineDataRaw } from '@plitzi/sdk-shared';

/** Where a space's own icon faces are served: `/_plitzi/icons/<hash>-<face>.woff2`. */
export const ICONS_PATH = '/_plitzi/icons/';

/** One face cut to the glyphs a space names. */
export type SpaceIconFace = IconFace & { codepoints: number[]; href: string };

/** The icons a space names, as faces of their own: what the page's head declares after the whole font's. */
export type SpaceIcons = { hash: string; faces: SpaceIconFace[] };

const ICON_NAME = /\bfa-[a-z0-9]+(?:-[a-z0-9]+)*/g;
// A regular icon is written `far fa-heart` or `fa-regular fa-heart`; the free regular face is a few hundred glyphs.
const REGULAR_STYLE = /\b(?:far|fa-regular)\b/;

const found = new WeakMap<OfflineDataRaw['schema'], SpaceIcons | null>();

const digest = (text: string): string => createHash('sha256').update(text).digest('base64url').slice(0, 16);

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
  const named = new Set(text.match(ICON_NAME));
  const brands: number[] = [];
  const others: number[] = [];
  for (const name of named) {
    const codepoint = glyphs.codepoints.get(name);
    if (codepoint !== undefined) {
      (glyphs.brands.has(name) ? brands : others).push(codepoint);
    }
  }

  const regular = REGULAR_STYLE.test(text);
  const ofFace = (face: IconFace): number[] => {
    if (face.key === 'brands') {
      return brands;
    }

    return face.key === 'solid' || regular ? others : [];
  };
  const cut = glyphs.faces.flatMap(face => {
    const codepoints = [...new Set(ofFace(face))].sort((a, b) => a - b);

    return codepoints.length > 0 ? [{ ...face, codepoints }] : [];
  });
  if (cut.length === 0) {
    return undefined;
  }

  const hash = digest(cut.map(face => `${face.key}:${face.codepoints.join(',')}`).join(';'));

  return { hash, faces: cut.map(face => ({ ...face, href: `${ICONS_PATH}${hash}-${face.key}.woff2` })) };
};

const unicodeRange = (codepoints: number[]): string =>
  codepoints.map(codepoint => `U+${codepoint.toString(16).toUpperCase()}`).join(',');

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
