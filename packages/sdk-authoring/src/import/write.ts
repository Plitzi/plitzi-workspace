/* eslint-disable quotes -- this file writes TypeScript: prettier keeps the quotes inside its strings, eslint wants them single */
import { isValidElementId } from '@plitzi/sdk-schema/helpers/elementId';

import type { ImportProbe, ImportNode } from './probe';
import type { DisplayMode, GoogleFont } from '@plitzi/sdk-shared';

/** The colours the page shows in the dark scheme, by the light colour each one replaces. */
export interface ImportedDark {
  colours: Record<string, string>;
  customProperties: Record<string, string>;
}

/** The page as it was measured: once per width, and what changes in the dark scheme when it has one. */
export interface ImportedPage {
  probes: ImportProbe[];
  dark?: ImportedDark;
}

/**
 * What the dark scheme changes, from a probe of it that read the light probe's colour samples again — or nothing,
 * when the page looks the same in both and has no dark scheme of its own.
 */
export const darkScheme = (light: ImportProbe, dark: ImportProbe): ImportedDark | undefined => {
  const colours = Object.fromEntries(
    Object.keys(light.colors.samples).flatMap((colour, index) => {
      const value = dark.read.at(index);

      return value ? [[colour, value]] : [];
    })
  );
  const changed =
    Object.entries(colours).some(([colour, value]) => colour !== value) ||
    Object.entries(light.customProperties).some(([name, value]) => dark.customProperties[name] !== value);

  return changed ? { colours, customProperties: dark.customProperties } : undefined;
};

/** What an import found, counted — the few lines `plitzi page import` answers with. */
export interface ImportSummary {
  url: string;
  widths: number[];
  colours: number;
  /** Whether the page had a scheme of its own in the dark, rather than the light one again. */
  dark: boolean;
  shadows: number;
  radii: number;
  fonts: string[];
  blocks: number;
  lists: { file: string; rows: number }[];
  pictures: number;
}

export interface Imported {
  files: ImportedFile[];
  summary: ImportSummary;
}

export interface ImportedFile {
  /** Relative to the folder the import is written in. */
  path: string;
  content: string;
}

/** A block of `outline.ts` per breakpoint, by the probe it was read from. */
const RANGES: { mode: Exclude<DisplayMode, 'desktop'>; below: number; from: number }[] = [
  { mode: 'tablet', from: 768, below: 1024 },
  { mode: 'mobile', from: 0, below: 768 }
];

/** What a key's absence means: a rule the desktop has and a narrower width does not is set back to this. */
const PLAIN: Partial<Record<string, string>> = {
  display: 'block',
  flexDirection: 'row',
  flexWrap: 'nowrap',
  gridTemplateColumns: 'none',
  rowGap: '0px',
  columnGap: '0px',
  alignItems: 'normal',
  justifyContent: 'normal',
  maxWidth: 'none',
  paddingTop: '0px',
  paddingRight: '0px',
  paddingBottom: '0px',
  paddingLeft: '0px',
  marginLeft: '0px',
  marginRight: '0px',
  backgroundColor: 'transparent',
  borderRadius: '0px'
};

/** The landmarks a container is written as; anything else is a `div`. */
const SUB_TYPES = new Set([
  'header',
  'footer',
  'nav',
  'main',
  'section',
  'article',
  'aside',
  'address',
  'figure',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6'
]);

const MAX_VARIABLES = 40;

/** Code written as it is, not quoted: a token reference in a generated literal. */
class Code {
  constructor(readonly text: string) {}
}

type Literal = string | number | boolean | Code | Literal[] | { [key: string]: Literal | undefined };

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

const quote = (text: string): string => `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;

const literal = (value: Literal, indent = ''): string => {
  if (value instanceof Code) {
    return value.text.replace(/\n/g, `\n${indent}`);
  }

  if (typeof value === 'string') {
    return quote(value);
  }

  if (typeof value !== 'object') {
    return String(value);
  }

  const inner = `${indent}  `;
  if (Array.isArray(value)) {
    return value.length === 0 ? '[]' : `[\n${value.map(item => inner + literal(item, inner)).join(',\n')}\n${indent}]`;
  }

  const entries = Object.entries(value).filter((entry): entry is [string, Literal] => entry[1] !== undefined);

  return entries.length === 0
    ? '{}'
    : `{\n${entries
        .map(([key, item]) => `${inner}${IDENTIFIER.test(key) ? key : quote(key)}: ${literal(item, inner)}`)
        .join(',\n')}\n${indent}}`;
};

export const importSlug = (text: string): string =>
  text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

/** Hands out names that are valid and not taken yet: `features`, then `features-2`. */
const namer = (fallback: string) => {
  const taken = new Set<string>();

  return (wanted: string | undefined, prefix = fallback): string => {
    const slug = importSlug(wanted ?? '');
    const base = /^[a-z]/.test(slug) ? slug : `${prefix}${slug ? `-${slug}` : ''}`;
    let name = base;
    for (let count = 2; taken.has(name); count++) {
      name = `${base}-${String(count)}`;
    }

    taken.add(name);

    return name;
  };
};

const COLOUR = /^(#[\da-f]{3,8}|rgba?\(|hsla?\(|oklch\(|oklab\(|lab\(|lch\(|color\()/i;

/** The page's palette as variables: its own custom properties where it has them, its dominant colours otherwise. */
/**
 * The page's palette as variables: its own custom properties first, by their names, then the dominant colours it
 * shows that none of those already is — `background`, `foreground`, `accent-N`.
 */
const paletteOf = (light: ImportProbe, dark: ImportedDark | undefined) => {
  const name = namer('color');
  const colours: Record<string, { light: string; dark: string; default: string }> = {};
  const custom: Record<string, string> = {};
  const skipped: string[] = [];
  const add = (wanted: string, lightValue: string, darkValue: string | undefined) => {
    colours[name(wanted)] = { light: lightValue, dark: darkValue ?? lightValue, default: lightValue };
  };

  for (const [property, value] of Object.entries(light.customProperties)) {
    // A framework's own plumbing (`--tw-ring-offset-shadow`) is not the design.
    if (property.startsWith('tw-') || !value) {
      continue;
    }

    if (Object.keys(colours).length + Object.keys(custom).length >= MAX_VARIABLES) {
      skipped.push(property);
      continue;
    }

    if (COLOUR.test(value)) {
      add(property, value, dark?.customProperties[property]);
    } else if (/^[\d.]+(px|rem|em|%)?$/.test(value) || /^[\d.]+(px|rem|em)( [\d.]+(px|rem|em)){1,3}$/.test(value)) {
      custom[name(property)] = value;
    } else {
      skipped.push(property);
    }
  }

  const named = new Set(Object.values(colours).map(colour => colour.light.toLowerCase()));
  const unnamed = (colour: string | undefined): colour is string =>
    colour !== undefined && !named.has(colour.toLowerCase());
  if (unnamed(light.colors.background)) {
    add('background', light.colors.background, dark?.colours[light.colors.background]);
  }

  if (unnamed(light.colors.foreground)) {
    add('foreground', light.colors.foreground, dark?.colours[light.colors.foreground]);
  }

  light.colors.accents.filter(unnamed).forEach((colour, index) => {
    add(`accent-${String(index + 1)}`, colour, dark?.colours[colour]);
  });

  return { colours, custom, skipped };
};

const googleFontsOf = (probe: ImportProbe): GoogleFont[] =>
  probe.fonts.google.map(({ family, weights }) => ({
    source: 'google',
    family,
    fallback: probe.fonts.heading === family && probe.fonts.body !== family ? 'serif' : 'sans-serif',
    weights: weights.length > 0 ? weights : [400],
    styles: ['normal'],
    ...(probe.fonts.body === family ? { preload: true } : {})
  }));

type Rules = Record<string, string>;

/** The rules a narrower width changes, against the desktop's: a rule it drops goes back to the plain value. */
const differences = (desktop: Rules, narrower: Rules): Rules => {
  const changed: Rules = {};
  for (const key of new Set([...Object.keys(desktop), ...Object.keys(narrower)])) {
    const value = key in narrower ? narrower[key] : PLAIN[key];
    if (value !== undefined && value !== desktop[key]) {
      changed[key] = value;
    }
  }

  return changed;
};

const same = (a: Rules, b: Rules): boolean =>
  Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([key, value]) => b[key] === value);

const indexByPath = (nodes: ImportNode[], into = new Map<string, ImportNode>()): Map<string, ImportNode> => {
  for (const node of nodes) {
    into.set(node.path, node);
    indexByPath(node.children, into);
  }

  return into;
};

/**
 * The files an import is written as: tokens, the outline, one JSON per repeated list, the pictures it found and a
 * page saying what was not carried over. Pure — the CLI measures, takes the screenshots and writes them to disk.
 */
export const importedFiles = ({ probes, dark }: ImportedPage): Imported => {
  const ordered = probes.toSorted((a, b) => b.width - a.width);
  const desktop = ordered.at(0);
  if (!desktop) {
    throw new Error('importedFiles: no page was measured.');
  }

  const narrower = new Map(
    RANGES.flatMap(range => {
      const probe = ordered.find(candidate => candidate.width >= range.from && candidate.width < range.below);

      return probe && probe !== desktop ? [[range.mode, indexByPath(probe.outline)] as const] : [];
    })
  );

  const { colours, custom, skipped } = paletteOf(desktop, dark);
  const shadows = Object.fromEntries(desktop.shadows.map((shadow, index) => [`shadow-${String(index + 1)}`, shadow]));
  const radii = Object.fromEntries(desktop.radii.map((radius, index) => [`radius-${String(index + 1)}`, radius]));
  // The first name for a value is the one rules use: the page's own before a measured one.
  const tokenOf = new Map<string, string>();
  for (const [token, value] of [
    ...Object.entries(colours).map(([token, colour]) => [token, colour.light.toLowerCase()] as const),
    ...Object.entries(radii)
  ]) {
    if (!tokenOf.has(value)) {
      tokenOf.set(value, token);
    }
  }

  const fonts = googleFontsOf(desktop);

  const usedTokens = new Set<string>();
  const valueOf = (key: string, value: string): Literal => {
    const token = key === 'backgroundColor' || key === 'borderRadius' ? tokenOf.get(value.toLowerCase()) : undefined;
    if (token === undefined) {
      return value;
    }

    usedTokens.add(token);

    return new Code(IDENTIFIER.test(token) ? `t.${token}` : `t[${quote(token)}]`);
  };
  const rulesOf = (rules: Rules): Record<string, Literal> =>
    Object.fromEntries(Object.entries(rules).map(([key, value]) => [key, valueOf(key, value)]));

  const listName = namer('list');
  const listFiles = new Map(desktop.lists.map(list => [list.path, listName(list.name)]));
  const elementId = namer('block');

  const elementOf = (node: ImportNode): Code => {
    // A leaf stands for content that is not imported: it keeps the room it took, so the outline reads as the page.
    const leaf = node.children.length === 0;
    const own: Rules = { ...node.style, ...(leaf ? { minHeight: `${String(node.height)}px` } : {}) };
    const perMode = new Map<string, Rules>();
    for (const [mode, nodes] of narrower) {
      const there = nodes.get(node.path);
      // Not shown at that width: hidden there, and nothing else about it matters.
      perMode.set(
        mode,
        there
          ? differences(own, { ...there.style, ...(leaf ? { minHeight: `${String(there.height)}px` } : {}) })
          : { display: 'none' }
      );
    }

    const tablet = perMode.get('tablet');
    const mobile = perMode.get('mobile');
    const ranges: [string, Rules][] =
      tablet && mobile && same(tablet, mobile)
        ? [
            ['desktop', own],
            ['compact', tablet]
          ]
        : [['desktop', own], ...perMode];
    const css: Record<string, Literal> = Object.fromEntries(
      ranges.filter(([, rules]) => Object.keys(rules).length > 0).map(([mode, rules]) => [mode, rulesOf(rules)])
    );

    // The one item a repeated block is written as is named for the list, not for whichever item came first.
    const listFile = listFiles.get(node.path);
    const id = elementId(
      node.id ?? (listFile ? `${listFile}-item` : node.heading),
      node.tag === 'div' ? 'block' : node.tag
    );
    if (!isValidElementId(id)) {
      throw new Error(`importedFiles: "${id}" is not a valid element id.`);
    }

    const props: Record<string, Literal | undefined> = {
      id,
      subType: SUB_TYPES.has(node.tag) ? node.tag : undefined,
      css: Object.keys(css).length > 0 ? css : undefined,
      children: node.children.length > 0 ? node.children.map(elementOf) : undefined
    };
    const note =
      node.repeats === undefined
        ? ''
        : `// One of ${String(node.repeats)} alike: a list${listFile ? ` — its rows are in data/${listFile}.json` : ''}.\n`;

    return new Code(`${note}container(${literal(props)})`);
  };

  const body = desktop.outline.map(elementOf);
  const widths = ordered.map(probe => `${String(probe.width)}px`).join(', ');

  const tokensFile = [
    '/**',
    ` * The tokens of ${desktop.url}, as measured: its colours with a value per theme, the corners and shadows it repeats,`,
    ' * and the Google fonts it loads. Rename them for what they mean — `accent-1` is only the next most used colour.',
    ' */',
    "import { tokens } from '@plitzi/sdk-authoring';",
    '',
    "import type { SpaceSpec } from '@plitzi/sdk-authoring';",
    '',
    `export const variables = ${literal({
      color: colours,
      ...(Object.keys(shadows).length > 0 ? { shadow: shadows } : {}),
      ...(Object.keys(custom).length + Object.keys(radii).length > 0 ? { custom: { ...radii, ...custom } } : {})
    })} satisfies SpaceSpec['variables'];`,
    '',
    `export const fonts: NonNullable<SpaceSpec['fonts']> = ${literal(fonts)};`,
    '',
    'export const t = tokens(variables);',
    ''
  ].join('\n');

  const outlineFile = [
    '/**',
    ` * The outline of ${desktop.url} at ${widths}: its blocks and their layout, without its words or pictures.`,
    ' * A starting point to write the page from — see IMPORT.md.',
    ' */',
    "import { container } from '@plitzi/sdk-authoring';",
    '',
    ...(usedTokens.size > 0 ? ["import { t } from './tokens.ts';", ''] : []),
    "import type { ElementSpec } from '@plitzi/sdk-authoring';",
    '',
    `export const outline: ElementSpec[] = [\n${body.map(code => `  ${code.text.replace(/\n/g, '\n  ')}`).join(',\n')}\n];`,
    ''
  ].join('\n');

  const dataFiles = desktop.lists.map(list => ({
    path: `data/${listFiles.get(list.path) ?? list.name}.json`,
    content: `${JSON.stringify({ items: list.items }, null, 2)}\n`
  }));

  const notes = [
    `# Imported from ${desktop.url}`,
    '',
    `Measured at ${widths}${dark ? ', and again in the dark scheme' : ''}. This is a place to start writing from, not a copy:`,
    'the structure and the measures are here, the words and the behaviour are yours to write.',
    '',
    '> Only import a site you own or have permission to reuse. Its text, pictures and brand belong to their owner —',
    '> nothing of them is carried over except the rows in `data/`, which are for you to replace.',
    '',
    '## What is here',
    '',
    '- `tokens.ts` — the colours (light and dark), corners, shadows and Google fonts. Hand `variables` and `fonts` to the',
    '  space and write `t.<name>` in rules.',
    `- \`outline.ts\` — the blocks of the page (${String(body.length)} at the top) with their layout per breakpoint.`,
    '  A block without children keeps the height its content took, so the outline reads as the page until it is filled.',
    ...(dataFiles.length > 0
      ? [`- \`data/\` — the repeated lists found (${dataFiles.map(file => file.path.slice(5)).join(', ')}), as rows.`]
      : []),
    '- `assets.json` — the pictures the page shows, with their size and alt text.',
    '- `screens/` — the page at each width, to compare against.',
    '',
    '## Not carried over',
    '',
    '- Text, links and pictures: write them into the blocks, with ids for what something else refers to.',
    '- Hover and focus states, animations, forms, menus that open, and every script.',
    ...(dark
      ? []
      : ["- A dark scheme: the page has none, so each colour's `dark` value repeats `light`. Choose them."]),
    ...(desktop.fonts.body && !fonts.some(font => font.family === desktop.fonts.body)
      ? [`- The body font, ${desktop.fonts.body}: it is not from Google Fonts. Add it as a hosted or remote font.`]
      : []),
    ...(skipped.length > 0
      ? [
          `- ${String(skipped.length)} more custom properties of \`:root\`: ${skipped.slice(0, 12).join(', ')}${skipped.length > 12 ? '…' : ''}.`
        ]
      : []),
    '',
    '## Next',
    '',
    '1. Split `outline.ts` into one file per part of the page, each under `scope()`, and write its content.',
    '2. Turn each repeated block into a `list` over its `data/` file (see the `lists` reference).',
    '3. `npx plitzi page check` at every width, and compare with `screens/`.',
    ''
  ].join('\n');

  const countBlocks = (nodes: ImportNode[]): number =>
    nodes.reduce((count, child) => count + 1 + countBlocks(child.children), 0);

  return {
    files: [
      { path: 'tokens.ts', content: tokensFile },
      { path: 'outline.ts', content: outlineFile },
      ...dataFiles,
      { path: 'assets.json', content: `${JSON.stringify(desktop.assets, null, 2)}\n` },
      { path: 'IMPORT.md', content: notes }
    ],
    summary: {
      url: desktop.url,
      widths: ordered.map(probe => probe.width),
      colours: Object.keys(colours).length,
      dark: dark !== undefined,
      shadows: Object.keys(shadows).length,
      radii: Object.keys(radii).length,
      fonts: fonts.map(font => font.family),
      blocks: countBlocks(desktop.outline),
      lists: desktop.lists.map(list => ({
        file: `data/${listFiles.get(list.path) ?? list.name}.json`,
        rows: list.items.length
      })),
      pictures: desktop.assets.length
    }
  };
};
