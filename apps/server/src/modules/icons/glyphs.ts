import { readFileSync } from 'node:fs';
import path from 'node:path';

/** A face of the icon font, as the SDK's icon stylesheet declares it: the family, the weight and its file. */
export type IconFace = { key: 'solid' | 'regular' | 'brands'; family: string; weight: string; file: string };

/** Every icon name the SDK's sheet draws, its glyph, and which names are the brands' face. */
export type IconGlyphs = { codepoints: ReadonlyMap<string, number>; brands: ReadonlySet<string>; faces: IconFace[] };

const FACE_RULE = /@font-face\{([^}]*)\}/g;
const FACE_FIELD = (field: string) => new RegExp(`${field}:\\s*"?([^;"]+)"?`);
const FACE_FILE = /url\(webfonts\/([\w.-]+)\)/;
// `.fa-check{--fa:"\f00c"}`, or several names for one glyph: `.fa-a,.fa-b{--fa:"\f0a1"}`.
const GLYPH_RULE = /((?:\.fa-[a-z0-9-]+,?)+)\{--fa:"((?:\\[0-9a-f]+ ?)|[^"\\])"/g;
const BRANDS_FAMILY = 'Font Awesome 7 Brands';

/** A CSS string's one character: `\f00c`, `\30 ` (an escape and the space that ends it) or the character itself. */
const codepointOf = (value: string): number =>
  value.startsWith('\\') ? Number.parseInt(value.slice(1).trim(), 16) : (value.codePointAt(0) ?? 0);

const faceKey = (family: string, weight: string): IconFace['key'] | undefined => {
  if (family === BRANDS_FAMILY) {
    return 'brands';
  }

  if (weight === '900') {
    return 'solid';
  }

  return weight === '400' ? 'regular' : undefined;
};

/**
 * The SDK's icon stylesheet read for what it draws: each name's glyph, the faces and their files. The sheet is Font
 * Awesome's sheets one after another (`apps/sdk`'s `iconsPlugin`), the brands' last: a name declared after the brands'
 * face is a brand.
 */
export const parseIconGlyphs = (css: string): IconGlyphs => {
  const faces: IconFace[] = [];
  for (const [, body] of css.matchAll(FACE_RULE)) {
    const family = FACE_FIELD('font-family').exec(body)?.[1];
    const weight = FACE_FIELD('font-weight').exec(body)?.[1];
    const file = FACE_FILE.exec(body)?.[1];
    const key = family && weight ? faceKey(family, weight) : undefined;
    if (family && weight && file && key) {
      faces.push({ key, family, weight, file });
    }
  }

  const brandsFrom = css.indexOf(`"${BRANDS_FAMILY}"`);
  const codepoints = new Map<string, number>();
  const brands = new Set<string>();
  for (const match of css.matchAll(GLYPH_RULE)) {
    const codepoint = codepointOf(match[2]);
    for (const selector of match[1].split(',')) {
      const name = selector.slice(1);
      codepoints.set(name, codepoint);
      if (brandsFrom >= 0 && match.index > brandsFrom) {
        brands.add(name);
      }
    }
  }

  return { codepoints, brands, faces };
};

const read = new Map<string, IconGlyphs>();

/** The glyphs of the SDK installed at `sdkDir`, read once per process. */
export const iconGlyphsAt = (sdkDir: string): IconGlyphs => {
  const known = read.get(sdkDir);
  if (known) {
    return known;
  }

  const glyphs = parseIconGlyphs(readFileSync(path.join(sdkDir, 'plitzi-sdk-icons.css'), 'utf8'));
  read.set(sdkDir, glyphs);

  return glyphs;
};
