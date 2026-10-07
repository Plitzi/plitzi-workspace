/* eslint-disable quotes -- the messages quote code, which reads best in the other quotes */
import type { Suggestion } from './types';
import type { Schema, Style, StyleVariableValue } from '@plitzi/sdk-shared';

/** The parts of the style document what is declared is read from. */
type Declared = Pick<Style, 'platform' | 'variables' | 'fonts'>;

/**
 * What a space declares and nothing reads, and what it says by hand where it has a name for it — the drift a big space
 * gathers as it is edited: a class kept after the last element wearing it went, a token nobody points at, a colour
 * written out where its token was meant, a component no page places.
 *
 * Two tokens of one value are not among them: `background` and `on-primary` may agree today and mean different things.
 *
 * Each is read generously, so a suggestion is never wrong: a name counts as used wherever it appears as a word — in an
 * element, a binding, a flow, another class's `ancestors`, `customCss` — even where it may only be prose.
 */

const NAME = /[\w-]+/g;

/** Every word the space's documents say outside the declaration being asked about. */
const wordsOf = (...texts: string[]): Set<string> => new Set(texts.flatMap(text => text.match(NAME) ?? []));

const TOKEN_USE = /var\(\s*--([\w-]+)/g;

const tokensRead = (...texts: string[]): Set<string> =>
  new Set(texts.flatMap(text => Array.from(text.matchAll(TOKEN_USE), match => match[1])));

const list = (names: string[], limit = 6): string =>
  `${names
    .slice(0, limit)
    .map(name => `\`${name}\``)
    .join(', ')}${names.length > limit ? `, and ${String(names.length - limit)} more` : ''}`;

const plural = (count: number, one: string, many: string): string => (count === 1 ? one : many);

/**
 * The space's own classes, and for every word the stylesheet says, which of its items say it — so a class named only in
 * its own rules (at another breakpoint, say) is not taken for one another class's `ancestors` names.
 */
const classesOf = (style: Declared): { names: Set<string>; namedBy: Map<string, Set<string>> } => {
  const items = Object.values(style.platform).flatMap(byName => Object.values(byName));
  const namedBy = new Map<string, Set<string>>();
  for (const item of items) {
    for (const word of wordsOf(JSON.stringify(item.attributes))) {
      namedBy.set(word, new Set([...(namedBy.get(word) ?? []), item.name]));
    }
  }

  return { names: new Set(items.filter(item => item.type === 'class').map(item => item.name)), namedBy };
};

const unusedClassNames = (schema: Schema, style: Declared): string[] => {
  const { names, namedBy } = classesOf(style);
  if (names.size === 0) {
    return [];
  }

  const schemaWords = wordsOf(JSON.stringify(schema));

  return [...names]
    .filter(name => !schemaWords.has(name) && ![...(namedBy.get(name) ?? [])].some(item => item !== name))
    .sort();
};

const unusedClasses = (unused: string[]): Suggestion[] => {
  if (unused.length === 0) {
    return [];
  }

  return [
    {
      code: 'unused-class',
      elementIds: [],
      subjects: unused,
      saves: 0,
      message:
        `${String(unused.length)} ${plural(unused.length, 'class is', 'classes are')} declared and worn by nothing — no ` +
        `element, binding, flow or other class names ${plural(unused.length, 'it', 'them')}: ${list(unused)}. Remove ` +
        `${plural(unused.length, 'it', 'them')} from \`classes\`; a class kept "for later" is one the next reader has to ` +
        'check is safe to change.'
    }
  ];
};

const HEX = /^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/;

/** A colour as one text whatever way it was written: `#ABC` and `#aabbcc` are one, so are `rgb(1,2,3)` and `rgb(1, 2, 3)`. */
const normalColour = (text: string): string => {
  const lower = text.trim().toLowerCase().replace(/\s+/g, '');
  const hex = HEX.exec(lower)?.[1];
  if (hex && hex.length <= 4) {
    return `#${hex.replace(/./g, digit => digit + digit)}`;
  }

  return lower;
};

const tokensOf = (style: Declared): { name: string; value: StyleVariableValue }[] =>
  Object.values(style.variables).flatMap(group => Object.entries(group).map(([name, value]) => ({ name, value })));

const unusedTokenNames = (schema: Schema, style: Declared, stylesheets: readonly string[] = []): string[] => {
  const tokens = tokensOf(style);
  if (tokens.length === 0) {
    return [];
  }

  // A selector's own variables read tokens too: `--ring: var(--brand)` declared on a class.
  const items = Object.values(style.platform).flatMap(byName => Object.values(byName));
  const read = tokensRead(
    JSON.stringify(schema),
    ...items.map(item => JSON.stringify(item.attributes)),
    ...items.map(item => JSON.stringify(item.variables ?? {})),
    JSON.stringify(style.variables),
    JSON.stringify(style.fonts ?? []),
    ...stylesheets
  );

  return tokens
    .map(token => token.name)
    .filter(name => !read.has(name))
    .sort();
};

const unusedTokens = (unused: string[]): Suggestion[] => {
  if (unused.length === 0) {
    return [];
  }

  return [
    {
      code: 'unused-token',
      elementIds: [],
      subjects: unused,
      saves: 0,
      message:
        `${String(unused.length)} ${plural(unused.length, 'token is', 'tokens are')} declared and read nowhere — no ` +
        `\`var(--…)\` in a class, an element, \`customCss\`, another token or a plugin's stylesheet: ${list(unused)}. Remove ` +
        `${plural(unused.length, 'it', 'them')} from \`variables\`, or use ${plural(unused.length, 'it', 'them')} where a ` +
        'colour is written out instead.'
    }
  ];
};

// White and black are written out on purpose far more often than they stand for a token that happens to be either —
// the words on a photograph, the mark on an accent.
const ABSOLUTE = new Set(['#ffffff', '#ffffffff', '#000000', '#000000ff', 'rgb(255,255,255)', 'rgb(0,0,0)']);

const COLOUR_LITERAL = /#(?:[\da-fA-F]{8}|[\da-fA-F]{6}|[\da-fA-F]{3,4})\b|(?:rgba?|hsla?)\([^)]*\)/g;

/** Every string value in a style item's attributes, at any depth: states, variants, ancestors, breakpoints. */
const stringsOf = (value: unknown): string[] => {
  if (typeof value === 'string') {
    return [value];
  }

  if (value && typeof value === 'object') {
    return Object.values(value).flatMap(stringsOf);
  }

  return [];
};

const literalColours = (style: Style): Suggestion[] => {
  // Only a token that changes with the scheme: a literal of one that does not is the same colour either way, and may
  // mean something the token does not — white on a photograph is not "the text on an accent".
  const tokenOf = new Map<string, string>();
  for (const { name, value } of tokensOf(style)) {
    if (typeof value !== 'object' || !value.light || !value.dark) {
      continue;
    }

    const light = normalColour(value.light);
    if (light !== normalColour(value.dark) && !light.startsWith('var(') && !ABSOLUTE.has(light)) {
      tokenOf.set(light, name);
    }
  }

  if (tokenOf.size === 0) {
    return [];
  }

  // Only in a class already painted from the palette: one written all in literals — a sticker's paper and ink, a
  // swatch — is a palette of its own, on purpose.
  const colourTokens = new Set(Object.keys(style.variables.color ?? {}));
  const paintedFromPalette = (text: string): boolean =>
    Array.from(text.matchAll(TOKEN_USE), match => match[1]).some(name => colourTokens.has(name));
  const written = new Map<string, Set<string>>();
  for (const [, byName] of Object.entries(style.platform)) {
    for (const item of Object.values(byName)) {
      if (!paintedFromPalette(JSON.stringify(item.attributes))) {
        continue;
      }

      for (const text of stringsOf(item.attributes)) {
        for (const literal of text.match(COLOUR_LITERAL) ?? []) {
          const token = tokenOf.get(normalColour(literal));
          if (token) {
            written.set(token, new Set([...(written.get(token) ?? []), item.name]));
          }
        }
      }
    }
  }

  if (written.size === 0) {
    return [];
  }

  const uses = [...written.entries()].sort(([a], [b]) => a.localeCompare(b));

  return [
    {
      code: 'literal-colour',
      elementIds: [],
      subjects: uses.flatMap(([token, items]) => [...items].map(item => `${item}:${token}`)),
      saves: 0,
      message:
        `A class painted from the palette writes a colour out that is a token's light value: ${uses
          .slice(0, 5)
          .map(([token, items]) => `\`--${token}\` in ${list([...items], 3)}`)
          .join('; ')}${uses.length > 5 ? '; …' : ''}. In the dark scheme the literal stays put while the palette ` +
        'moves. Write `var(--token)` when it should follow; when it must stay — dark words on a light chip in both ' +
        "schemes — name it: a token of one value (`ink-on-chip: '#14131a'`), so the next reader knows it is meant."
    }
  ];
};

const unusedComponentIds = (schema: Schema): string[] => {
  const ids = Object.keys(schema.components);
  if (ids.length === 0) {
    return [];
  }

  const placed = new Set(
    [schema.flat, ...Object.values(schema.components).map(component => component.flat)]
      .flatMap(flat => Object.values(flat))
      .filter(element => element.definition.type === 'reference')
      .map(element => element.attributes.referenceId)
      .filter((id): id is string => typeof id === 'string')
  );

  return ids.filter(id => !placed.has(id)).sort();
};

const unusedComponents = (schema: Schema, unused: string[]): Suggestion[] => {
  if (unused.length === 0) {
    return [];
  }

  const saves = unused.reduce((total, id) => total + Object.keys(schema.components[id].flat).length, 0);

  return [
    {
      code: 'unused-component',
      elementIds: [],
      subjects: unused,
      saves,
      message:
        `${String(unused.length)} ${plural(unused.length, 'component is', 'components are')} declared and placed on no ` +
        `page, layout or other component: ${list(unused)}. Remove ${plural(unused.length, 'it', 'them')} from ` +
        '`components` — the builder still lists a component nobody uses, and every reader wonders where it shows.'
    }
  ];
};

/**
 * What a space declares and nothing uses — its classes, tokens and components — by the one rule the suggestions, the
 * builder's Usages panel and anything else that says "unused" read, so they never disagree.
 */
export const unusedDeclarations = (
  schema: Schema,
  style: Declared,
  /** The CSS the pages load besides the space's own — its plugins' stylesheets — whose `var(--…)` read tokens too. */
  stylesheets: readonly string[] = []
): { classes: string[]; tokens: string[]; components: string[] } => ({
  classes: unusedClassNames(schema, style),
  tokens: unusedTokenNames(schema, style, stylesheets),
  components: unusedComponentIds(schema)
});

export const suggestDeclarations = (
  schema: Schema,
  style: Style,
  stylesheets: readonly string[] = []
): Suggestion[] => {
  const unused = unusedDeclarations(schema, style, stylesheets);

  return [
    ...unusedComponents(schema, unused.components),
    ...unusedClasses(unused.classes),
    ...unusedTokens(unused.tokens),
    ...literalColours(style)
  ];
};
