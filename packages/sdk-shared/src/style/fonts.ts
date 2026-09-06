import type { FontHead, GoogleFont, HostedFont, RemoteFont, SpaceFont, SystemFont } from '../types/StyleTypes';

const GOOGLE_CSS_ORIGIN = 'https://fonts.googleapis.com';
const GOOGLE_FILE_ORIGIN = 'https://fonts.gstatic.com';

const MIME_BY_FORMAT = { woff2: 'font/woff2', woff: 'font/woff' } as const;

/**
 * The stacks every visitor already has, which is why they are a constant and not rows in each
 * space document: they cost no bytes, they cannot be uploaded or removed, and a picker that did
 * not offer them would make "no web font at all" an option nobody could choose.
 *
 * The weights are what a system face can be relied on for; anything else is synthesized by the
 * browser, which is the effect this whole manifest exists to make visible rather than accidental.
 */
export const SYSTEM_FONTS: SystemFont[] = [
  {
    source: 'system',
    family: 'system-ui',
    fallback: '-apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    weights: [400, 700],
    styles: ['normal', 'italic']
  },
  {
    source: 'system',
    family: 'Arial',
    fallback: 'Helvetica, sans-serif',
    weights: [400, 700],
    styles: ['normal', 'italic']
  },
  {
    source: 'system',
    family: 'Verdana',
    fallback: 'Geneva, sans-serif',
    weights: [400, 700],
    styles: ['normal', 'italic']
  },
  {
    source: 'system',
    family: 'Trebuchet MS',
    fallback: 'Helvetica, sans-serif',
    weights: [400, 700],
    styles: ['normal', 'italic']
  },
  {
    source: 'system',
    family: 'Georgia',
    fallback: '"Times New Roman", serif',
    weights: [400, 700],
    styles: ['normal', 'italic']
  },
  {
    source: 'system',
    family: 'Times New Roman',
    fallback: 'Times, serif',
    weights: [400, 700],
    styles: ['normal', 'italic']
  },
  {
    source: 'system',
    family: 'Courier New',
    fallback: 'ui-monospace, monospace',
    weights: [400, 700],
    styles: ['normal', 'italic']
  },
  {
    source: 'system',
    family: 'ui-monospace',
    fallback: 'SFMono-Regular, Menlo, Consolas, monospace',
    weights: [400, 700],
    styles: ['normal', 'italic']
  }
];

/** What a space can actually name: what it declared, over the stacks that are always there. A
 *  family declared by the space wins, so a space may upload its own "Arial" and mean it. */
export const availableFonts = (fonts: SpaceFont[]): SpaceFont[] => {
  const declared = new Set(fonts.map(font => font.family));

  return [...fonts, ...SYSTEM_FONTS.filter(font => !declared.has(font.family))];
};

/**
 * A URL out of a space document is a URL a person typed, and it is about to become a `href` or a
 * `@font-face` src. Nothing but plain https gets through: `javascript:` and `data:` are script in
 * a link's clothing, and credentials in the authority are a password published to every visitor.
 */
export const isSafeFontUrl = (value: string): boolean => {
  try {
    const url = new URL(value);

    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
};

const originOf = (value: string): string | undefined => {
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
};

/**
 * A CSS string literal.
 *
 * `"` and `\` are escaped because a family name may legally hold either. `<` and `>` are escaped as CSS hex
 * sequences for a different reason: this string is written into a `<style>` element by three templates, and a
 * family called `x</style><script>` would otherwise close the block and keep going. The name is typed by a user.
 */
const CSS_HEX_ESCAPES: Record<string, string> = { '<': '\\3c ', '>': '\\3e ' };

const cssString = (value: string): string =>
  `"${value.replace(/[\\"<>]/g, match => CSS_HEX_ESCAPES[match] ?? `\\${match}`)}"`;

/** `U+0-FF`, `U+4??`, or a comma-separated list of those. Anything else is dropped rather than written into a
 *  declaration, since unlike every other field here it is free text with no quoting to hide behind. */
const UNICODE_RANGE = /^U\+[0-9A-Fa-f?]{1,6}(-[0-9A-Fa-f]{1,6})?(\s*,\s*U\+[0-9A-Fa-f?]{1,6}(-[0-9A-Fa-f]{1,6})?)*$/;

const isBareIdentifier = (family: string): boolean => /^[a-zA-Z][a-zA-Z0-9-]*$/.test(family);

/** What a `font-family` declaration should say for this font: the family, then what renders until
 *  it arrives. Quoted unless the name is a single bare identifier, which is what CSS asks for. */
export const fontFamilyStack = (font: SpaceFont): string => {
  const family = isBareIdentifier(font.family) ? font.family : cssString(font.family);

  return font.fallback ? `${family}, ${font.fallback}` : family;
};

/** The family a `font-family` value leads with — the one the manifest is keyed by. The rest of the value is the
 *  fallback chain, which names nothing this space has to load. */
export const primaryFamily = (value: string): string =>
  (value.split(',')[0] ?? '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .trim();

const uniqueWeights = (font: SpaceFont): number[] => {
  const weights = [...new Set(font.weights)].filter(weight => Number.isFinite(weight)).sort((a, b) => a - b);

  return weights.length > 0 ? weights : [400];
};

const familyParam = (family: string): string => encodeURIComponent(family).replace(/%20/g, '+');

/**
 * One `css2` request for every Google family in the manifest.
 *
 * The axis tuples have to be listed in ascending order or the API answers 400, and the families
 * are sorted for a reason of our own: the URL is a cache key, and two spaces with the same fonts
 * in a different order should not be two entries in every CDN between here and the visitor.
 *
 * `subsets` is deliberately NOT sent. The v1 API took `subset=`; css2 answers with the full set of
 * unicode-range-split faces and lets the browser fetch only the ranges a page actually uses, which
 * is strictly better. The field stays on the manifest because mirroring (which downloads files
 * rather than linking them) does have to know which ranges to keep.
 */
export const googleCss2Url = (fonts: GoogleFont[]): string => {
  const families = [...fonts]
    .sort((a, b) => a.family.localeCompare(b.family))
    .map(font => {
      const weights = uniqueWeights(font);
      const hasItalic = font.styles.includes('italic');
      if (!hasItalic) {
        return `family=${familyParam(font.family)}:wght@${weights.join(';')}`;
      }

      const tuples = [0, 1].flatMap(ital => weights.map(weight => `${ital},${weight}`));

      return `family=${familyParam(font.family)}:ital,wght@${tuples.join(';')}`;
    });

  const displays = [...new Set(fonts.map(font => font.display ?? 'swap'))];
  // css2 takes one `display` for the whole request; families that disagree fall back to the value
  // that keeps text visible, which is the one worth defaulting to anyway.
  const display = displays.length === 1 ? displays[0] : 'swap';

  return `${GOOGLE_CSS_ORIGIN}/css2?${families.join('&')}&display=${display}`;
};

/**
 * The stylesheet that draws family NAMES in their own typeface — the font picker, and nothing else.
 *
 * `text` is what makes it cheap: Google returns faces covering only those glyphs, a few hundred
 * bytes for a whole list. It is also what makes it useless for a page, so this never renders one.
 */
export const googleTextSubsetUrl = (families: string[], text: string): string => {
  const params = [...families]
    .sort((a, b) => a.localeCompare(b))
    .map(family => `family=${familyParam(family)}`)
    .join('&');

  return `${GOOGLE_CSS_ORIGIN}/css2?${params}&text=${encodeURIComponent(text)}&display=swap`;
};

const DEFAULT_FONT_BASE_URL = '/fonts';

/**
 * The `resolveUrl` every surface passes to {@link fontsToHead}: a store-relative path, joined to wherever THIS
 * deployment serves font files from. `/fonts` by default, which is a self-hosted server serving its own; a cloud
 * deployment passes its CDN prefix. One joining rule, because the SSR document, the client and the static export
 * have to agree on the URL down to the slash or they fetch the same face twice.
 */
export const fontUrlResolver =
  (baseUrl = DEFAULT_FONT_BASE_URL) =>
  (path: string): string =>
    `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;

/**
 * The generic families and CSS-wide keywords, which name no file and so need no manifest entry. `system-ui` and the
 * `ui-*` group are here too: the browser resolves them against what the machine already has.
 */
const GENERIC_FAMILIES = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'ui-rounded',
  'math',
  'emoji',
  'fangsong',
  'inherit',
  'initial',
  'revert',
  'revert-layer',
  'unset'
]);

/**
 * The families a stylesheet CHOOSES, which is not the same as every family it mentions and not the same as the
 * ones it loads — that second gap is the whole reason the manifest exists.
 *
 * One family per declaration: the rest of a stack is the fallback chain, and a chain is not a choice. Declaring
 * `SFMono-Regular` because it appears third in a monospace stack would fill a space's manifest with families
 * nobody picked and nothing should fetch.
 *
 * A declaration whose lead is a generic (`sans-serif`, `ui-monospace`) contributes nothing: the browser already
 * has it. So does one built from a variable — what `var(--font-heading)` resolves to is a fact about the
 * variables, and the variable's own value is scanned in its place.
 */
export const familiesInCss = (css: string): string[] => {
  const families = new Set<string>();

  for (const match of css.matchAll(/font-family\s*:\s*([^;}]+)/g)) {
    const value = match[1];
    if (value.includes('var(')) {
      continue;
    }

    const lead = primaryFamily(value);
    if (lead && !GENERIC_FAMILIES.has(lead.toLowerCase())) {
      families.add(lead);
    }
  }

  return [...families];
};

type ResolvedFace = { weight: number; style: string; format: 'woff2' | 'woff'; url: string; unicodeRange?: string };

const faceBlock = (font: RemoteFont | HostedFont, face: ResolvedFace): string =>
  [
    '@font-face{',
    `font-family:${cssString(font.family)};`,
    `font-style:${face.style === 'italic' ? 'italic' : 'normal'};`,
    // Parsed rather than interpolated: the manifest is a stored document, and a weight that is not a number is the
    // one field here with no quoting around it to keep a stray `;` from becoming a second declaration.
    `font-weight:${Number.parseInt(String(face.weight), 10) || 400};`,
    `font-display:${font.display ?? 'swap'};`,
    `src:url(${cssString(face.url)}) format(${cssString(face.format)});`,
    face.unicodeRange && UNICODE_RANGE.test(face.unicodeRange) ? `unicode-range:${face.unicodeRange};` : '',
    '}'
  ].join('');

/**
 * Everything a document has to carry so the manifest's families actually render.
 *
 * Pure on purpose: SSR writes it into a template, the client writes it into `document.head`, the
 * builder canvas writes it into its iframe and the static export bakes it in. They disagree about
 * where a hosted file lives and about nothing else, which is what `resolveUrl` is for — a
 * store-relative path becomes a CDN URL, a local `/fonts/*` URL, or whatever the export needs.
 */
export const fontsToHead = (fonts: SpaceFont[], resolveUrl: (path: string) => string): FontHead => {
  const links: FontHead['links'] = [];
  const preloads: FontHead['links'] = [];
  const faces: string[] = [];
  const preconnect = new Map<string, boolean>();
  const origins = new Set<string>();

  const reach = (origin: string | undefined, servesFiles: boolean): void => {
    if (!origin) {
      return;
    }

    origins.add(origin);
    preconnect.set(origin, (preconnect.get(origin) ?? false) || servesFiles);
  };

  const googleFonts = fonts.filter((font): font is GoogleFont => font.source === 'google');
  if (googleFonts.length > 0) {
    const href = googleCss2Url(googleFonts);
    reach(GOOGLE_CSS_ORIGIN, false);
    // The stylesheet and the files it names are two different origins, and the second one is where
    // the bytes are: without its own preconnect that connection is opened only once the CSS has
    // already been fetched and parsed.
    reach(GOOGLE_FILE_ORIGIN, true);
    // A linked stylesheet hides the file URLs from us, so `preload` can only be honoured one level
    // up — fetching the CSS at the highest priority instead of the face it names.
    if (googleFonts.some(font => font.preload)) {
      preloads.push({ href, rel: 'preload', as: 'style' });
    }

    links.push({ href, rel: 'stylesheet' });
  }

  fonts.forEach(font => {
    if (font.source === 'remote' && font.stylesheet && isSafeFontUrl(font.stylesheet)) {
      reach(originOf(font.stylesheet), false);

      if (font.preload) {
        preloads.push({ href: font.stylesheet, rel: 'preload', as: 'style' });
      }

      links.push({ href: font.stylesheet, rel: 'stylesheet' });

      return;
    }

    if (font.source === 'remote' && font.files) {
      font.files
        .filter(file => isSafeFontUrl(file.url))
        .forEach(file => {
          reach(originOf(file.url), true);

          faces.push(faceBlock(font, { ...file, url: file.url }));
          if (font.preload) {
            preloads.push({
              href: file.url,
              rel: 'preload',
              as: 'font',
              type: MIME_BY_FORMAT[file.format],
              crossorigin: true
            });
          }
        });

      return;
    }

    if (font.source === 'hosted') {
      font.files.forEach(file => {
        const url = resolveUrl(file.path);
        reach(originOf(url), true);

        faces.push(faceBlock(font, { ...file, url }));
        if (font.preload) {
          preloads.push({
            href: url,
            rel: 'preload',
            as: 'font',
            type: MIME_BY_FORMAT[file.format],
            // A font is fetched in CORS mode whatever its origin, so a preload that omits this
            // fetches the file a second time instead of priming the one the face will use.
            crossorigin: true
          });
        }
      });
    }
  });

  return {
    preconnect: [...preconnect].map(([href, crossorigin]) => (crossorigin ? { href, crossorigin } : { href })),
    links: [...preloads, ...links],
    faces: faces.join(''),
    origins: [...origins]
  };
};
