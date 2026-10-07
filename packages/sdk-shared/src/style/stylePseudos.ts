/**
 * The pseudo-elements a class can dress — parts of an element the page has no node for: the box drawn before or after
 * its content, a list item's bullet, an empty field's hint, the first letter or line of a paragraph, the text a visitor
 * selects. One list, read by the type, the compiler, the style editor and authoring.
 *
 * Each is written last in its selector (`.card:hover::after`), which is the only place CSS allows it: a state, a
 * variant or a condition of the class chooses WHEN, the pseudo-element WHAT.
 */
export const STYLE_PSEUDOS = [
  'before',
  'after',
  'marker',
  'placeholder',
  'first-letter',
  'first-line',
  'selection'
] as const;

export type StylePseudo = (typeof STYLE_PSEUDOS)[number];

export const STYLE_PSEUDO_LABELS: Record<StylePseudo, string> = {
  before: '::before',
  after: '::after',
  marker: '::marker',
  placeholder: '::placeholder',
  'first-letter': '::first-letter',
  'first-line': '::first-line',
  selection: '::selection'
};

export const isStylePseudo = (pseudo: string): pseudo is StylePseudo => Object.hasOwn(STYLE_PSEUDO_LABELS, pseudo);

/** How a pseudo-element is written at the end of a selector. */
export const pseudoSuffix = (pseudo: StylePseudo): string => `::${pseudo}`;

/**
 * The pseudo-elements `content` draws — and must draw: a `::before` or `::after` without it is not there at all, and a
 * marker's `content` replaces the bullet.
 */
export const CONTENT_PSEUDOS: readonly StylePseudo[] = ['before', 'after', 'marker'];

/** The pseudo-elements that exist only once their `content` says so. */
export const GENERATED_PSEUDOS: readonly StylePseudo[] = ['before', 'after'];

const TEXT_PROPERTIES = [
  'color',
  'opacity',
  'text-decoration-line',
  'text-decoration-color',
  'text-decoration-style',
  'text-decoration-thickness',
  'text-underline-offset',
  'text-shadow',
  'text-transform',
  'letter-spacing',
  'word-spacing',
  'line-height',
  'vertical-align'
];

const FONT_PROPERTIES = [
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'font-variant-numeric',
  'font-feature-settings'
];

const BACKGROUND_PROPERTIES = [
  'background-color',
  'background-image',
  'background-position',
  'background-size',
  'background-repeat'
];

/**
 * The properties a browser honours on the pseudo-elements that take only a few — every other one is dropped without a
 * word, which is why authoring refuses it rather than writing a rule that does nothing. `before`, `after` and
 * `first-letter` are boxes of their own and take everything.
 *
 * Read from the CSS Pseudo-Elements spec and what the engines ship: `::selection` paints and nothing else, `::marker`
 * is a line of text, `::placeholder` and `::first-line` are text inside a box they do not own.
 */
export const PSEUDO_PROPERTIES: Partial<Record<StylePseudo, readonly string[]>> = {
  selection: ['color', 'background-color', 'text-decoration-line', 'text-decoration-color', 'text-shadow'],
  marker: ['color', 'content', 'direction', ...FONT_PROPERTIES],
  placeholder: [...TEXT_PROPERTIES, ...FONT_PROPERTIES, ...BACKGROUND_PROPERTIES],
  'first-line': [...TEXT_PROPERTIES, ...FONT_PROPERTIES, ...BACKGROUND_PROPERTIES]
};

/** Whether a pseudo-element honours a property. A custom property (`--x`) is carried by every one. */
export const pseudoHonours = (pseudo: StylePseudo, property: string): boolean => {
  const allowed = PSEUDO_PROPERTIES[pseudo];

  return !allowed || property.startsWith('--') || allowed.includes(property);
};

const CONTENT_KEYWORDS = new Set([
  'none',
  'normal',
  'open-quote',
  'close-quote',
  'no-open-quote',
  'no-close-quote',
  'inherit',
  'initial',
  'unset',
  'revert'
]);

const CONTENT_FUNCTIONS =
  /^(?:counter|counters|attr|url|var|image-set|linear-gradient|radial-gradient|conic-gradient)\(/i;

/** The value split where it is not inside quotes or brackets, at whitespace and at the `/` before an alternative text. */
const contentParts = (value: string): string[] | undefined => {
  const parts: string[] = [];
  let current = '';
  let quote = '';
  let depth = 0;
  for (const char of value) {
    if (quote) {
      current += char;
      quote = char === quote && !current.endsWith(`\\${char}`) ? '' : quote;
      continue;
    }

    // eslint-disable-next-line quotes -- the quote itself: Prettier writes it unescaped, between the other quotes
    if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth -= 1;
    } else if (depth === 0 && (/\s/.test(char) || char === '/')) {
      if (current) {
        parts.push(current);
      }

      current = '';
      continue;
    }

    current += char;
  }

  if (current) {
    parts.push(current);
  }

  return quote || depth !== 0 ? undefined : parts;
};

/**
 * Whether a `content` value draws something CSS can read: quoted text (`'"→"'`, `'""'` for an empty box), a keyword
 * (`none`, `open-quote`…), or a function (`counter()`, `attr()`, `url()`, `var()`), alone or several in a row.
 *
 * The usual slip is the text without its quotes — `content: '→'` from JavaScript is `content: →` in CSS, which every
 * browser drops — and it renders as no pseudo-element at all.
 */
export const isContentValue = (value: string): boolean => {
  const parts = contentParts(value.trim());
  if (!parts?.length) {
    return false;
  }

  return parts.every(
    part =>
      /^(["']).*\1$/s.test(part) ||
      CONTENT_KEYWORDS.has(part.toLowerCase()) ||
      (CONTENT_FUNCTIONS.test(part) && part.endsWith(')'))
  );
};
