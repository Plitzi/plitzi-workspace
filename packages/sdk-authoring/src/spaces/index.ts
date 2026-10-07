/* eslint-disable quotes */
import { authorSpace, slugify } from '../schema';
import blankContentSource from './blank/content.ts?raw';
import blankNotFoundSource from './blank/notFound.ts?raw';
import { space as blankSpaceSpec } from './blank/spec';
// The declaration's own source, inlined at build time — the copy `plitzi create` writes into a project. Read as
// text rather than through the filesystem because this package is bundled for the browser too.
import blankSpecSource from './blank/spec.ts?raw';
import blankThemeSource from './blank/theme.ts?raw';
import blankTokensSource from './blank/tokens.ts?raw';
import emptyNotFoundSource from './empty/notFound.ts?raw';
import { space as emptySpaceSpec } from './empty/spec';
import emptySpecSource from './empty/spec.ts?raw';
import catalogProducts from '../../templates/catalog/src/data/products.json?raw';
import catalogCard from '../../templates/catalog/src/space/components/productCard.ts?raw';
import catalogData from '../../templates/catalog/src/space/data.ts?raw';
import catalogSpace from '../../templates/catalog/src/space/index.ts?raw';
import catalogLayout from '../../templates/catalog/src/space/layout.ts?raw';
import catalogCatalogPage from '../../templates/catalog/src/space/pages/catalog.ts?raw';
import catalogHomePage from '../../templates/catalog/src/space/pages/home.ts?raw';
import catalogNotFoundPage from '../../templates/catalog/src/space/pages/notFound.ts?raw';
import catalogProductPage from '../../templates/catalog/src/space/pages/product.ts?raw';
import catalogTokens from '../../templates/catalog/src/space/tokens.ts?raw';

import type { AuthoredSpace, SpaceSpec } from '../schema';

/**
 * The declaration itself, under the name the platform knows it by.
 *
 * It is exported from its own file as `space`, because that file is copied verbatim into projects created with
 * `plitzi create` — and there, `blankSpaceSpec` would be a puzzle: the developer is looking at their own site,
 * not at Plitzi's blank one. Renamed here rather than rewritten on the way out, so the copy is the file.
 */
export { space as blankSpaceSpec } from './blank/spec';
export { space as emptySpaceSpec } from './empty/spec';

/**
 * The space a new space starts as — one page with a hero and six guides into the docs, not an empty document.
 *
 * It lives here rather than in the seeds of whichever server happens to create spaces, because two unrelated
 * things need it and they must not drift: the platform's `POST /spaces`, and `plitzi create`, which scaffolds a
 * project around it for somebody who has no account at all. When it was JSON inside one of them, the other kept a
 * copy — and a copy of a fixture is a fixture that is wrong six months later with nothing to say so.
 *
 * A declaration rather than an exported document, so whoever receives it can change it. `blankSpace()` is the
 * documents a renderer wants; `blankTemplateFiles()` are its files, for a project that will edit them.
 */

/** The two documents, authored fresh — so one caller writing its own name in cannot mark the next one's copy. */
export const blankSpace = (): AuthoredSpace => authorSpace(blankSpaceSpec);

/**
 * The declaration as files somebody can drop into their own project, optionally under a name of its own.
 *
 * The sources are this package's own — the same text that produced the documents above, so what a project starts
 * with and what Plitzi creates cannot come apart. Their imports of the package's modules are relative here because
 * they live inside it; on the way out they are rewritten to the package name, which is how the copy resolves anywhere
 * else. The files import each other as siblings, so the folder travels whole.
 *
 * The rename lives here, and not in the scaffold that asks for it, for the reason the whole function exists: a
 * caller renaming the copy would have to know which literals these files happen to contain, and a caller that
 * knows that is a caller that breaks silently the day one of them changes. Here the literals are read off
 * `blankSpaceSpec`, so they cannot be out of date, and a rename that finds nothing to replace throws.
 */
export interface BlankTemplateOptions {
  /** The name the copy carries. `permanentUrl` follows it, slugged. */
  name?: string;
  /** The folder the files are written in, relative to the project: `src/space` unless said. */
  dir?: string;
  /**
   * Add a `custom` element hosting a plugin the receiver supplies — or several, one after another, given a list.
   *
   * Off by default, and it has to be: the platform authors a new space from this same declaration and hosts none
   * of anybody's plugins, so a `custom` element in it would render "Custom Component … Not Found" on every space
   * anyone ever signed up for. It is on for `plitzi create`, where the project being scaffolded carries the
   * component and registers it — which is the one fact about Plitzi a page of built-in elements cannot show.
   */
  plugin?: PluginHostOptions | readonly PluginHostOptions[];
}

export interface PluginHostOptions {
  renderType: string;
  id: string;
  /**
   * How the space hosts it. `custom` (the default) is a `custom` element naming the component by `renderType` — a
   * component the page registers itself, as a project's own are. `element` is an element OF the plugin's type, the
   * way the builder adds a plugin somebody dropped: the one shape a plugin loaded from its manifest renders as.
   */
  as?: 'custom' | 'element';
  /** Written on the `custom` element as attributes, which the component receives as props of the same names. */
  attributes: Record<string, unknown>;
  /**
   * A provider around the plugin, and the props it feeds: `{ id: 'stats', query: '/data/stats.json', bind: { value:
   * 'stats.data.value' } }`. What a project with no backend shows its data with — a JSON file it serves itself.
   */
  data?: { id: string; query: string; bind: Record<string, string> };
}

/** A value as TypeScript source, in this codebase's quotes: what a JSON dump would write, with single quotes. */
/**
 * A string literal, quoted the way Prettier quotes one: single quotes, unless the text holds more of them than of
 * double quotes. The copy is somebody's source file, and one their formatter rewrites on the first save is noise in
 * their first diff.
 */
const stringLiteral = (value: string): string => {
  // \x22 and \x27 are the two quotes: spelled so, neither needs a quote of the other kind around it.
  const singles = value.split('\x27').length - 1;
  const doubles = value.split('\x22').length - 1;
  const quote = singles > doubles ? '\x22' : '\x27';

  return `${quote}${value.replace(/\\/g, '\\\\').replaceAll(quote, `\\${quote}`)}${quote}`;
};

const toSource = (value: unknown): string => {
  if (typeof value === 'string') {
    return stringLiteral(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(toSource).join(', ')}]`;
  }

  if (typeof value === 'object' && value !== null) {
    return `{ ${Object.entries(value)
      .map(([key, entry]) => `${/^[A-Za-z_$][\w$]*$/.test(key) ? key : toSource(key)}: ${toSource(entry)}`)
      .join(', ')} }`;
  }

  return typeof value === 'number' || typeof value === 'boolean' ? String(value) : 'null';
};

/**
 * The welcome space as a project's files, by path: the page and the space in `index.ts`, the palette in `tokens.ts`,
 * the classes in `theme.ts`, what the page says in `content.ts` — a file per part, as a space is written once it is
 * more than a screen. The plugin a project hosts and the name it carries go in `index.ts`, which holds both.
 */
export const blankTemplateFiles = ({ name, dir = 'src/space', plugin }: BlankTemplateOptions = {}): Record<
  string,
  string
> => {
  const plugins = plugin === undefined ? [] : Array.isArray(plugin) ? plugin : [plugin];
  const entry = toPortableSource(plugins.length > 0 ? withPluginHost(blankSpecSource, plugins) : blankSpecSource);

  return {
    [`${dir}/index.ts`]: name === undefined ? entry : renameSpace(entry, name),
    [`${dir}/tokens.ts`]: toPortableSource(blankTokensSource),
    [`${dir}/theme.ts`]: toPortableSource(blankThemeSource),
    [`${dir}/content.ts`]: toPortableSource(blankContentSource),
    [`${dir}/notFound.ts`]: toPortableSource(blankNotFoundSource)
  };
};

/**
 * The space `plitzi create --template blank` starts from, as its files by path: tokens, a layout and one empty page —
 * for a project about to be something specific, where the welcome tour is the first thing that would be deleted —
 * and the page for an address nothing answers, beside it.
 */
export const emptyTemplateFiles = ({ name, dir = 'src/space' }: { name?: string; dir?: string } = {}): Record<
  string,
  string
> => {
  const portable = toPortableSource(emptySpecSource);

  return {
    [`${dir}/index.ts`]: name === undefined ? portable : renameSpace(portable, name, emptySpaceSpec),
    [`${dir}/notFound.ts`]: toPortableSource(emptyNotFoundSource)
  };
};

/** The one line in the declaration a `custom` element is hung off — the hero, so it lands under its buttons. */
const PLUGIN_ANCHOR = 'children: [heroEyebrow, heroTitle, heroLede, heroActions]';

/** One plugin's host — a `custom(…)` or an `element(…)` call, inside its provider when it has one — at `pad`. */
const hostSource = (plugin: PluginHostOptions, pad: string): string => {
  const asElement = plugin.as === 'element';
  const host = (inner: string): string =>
    [
      asElement ? `element('${plugin.renderType}', {` : 'custom({',
      `  id: '${plugin.id}',`,
      ...(asElement ? [] : [`  renderType: '${plugin.renderType}',`]),
      ...Object.entries(plugin.attributes).map(([key, value]) => `  ${key}: ${toSource(value)},`),
      ...(plugin.data ? [`  bind: ${toSource(plugin.data.bind)},`] : []),
      "  css: { desktop: { 'margin-top': '24px' } }",
      '})'
    ].join(`\n${inner}`);

  return plugin.data
    ? [
        'apiContainer({',
        `  id: '${plugin.data.id}',`,
        `  query: '${plugin.data.query}',`,
        '  cache: true,',
        '  children: [',
        `    ${host(`${pad}    `)}`,
        '  ]',
        '})'
      ].join(`\n${pad}`)
    : host(pad);
};

/**
 * The copy, with a slot for a component the receiver writes.
 *
 * Done to the source rather than to the spec because the spec is not what travels: the copy is a FILE, and what
 * has to end up in it is a `custom(…)` call somebody can read, move and change. The import is prepended as a line
 * of its own rather than merged into the existing one — `toPortableSource` folds every relative import into a
 * single sorted statement afterwards, so this needs to know nothing about what the declaration already imports.
 *
 * The anchor is a whole authored line, and a miss throws. It is the same bargain as the rename: a source
 * transform that silently does nothing hands back a plausible file with the interesting half missing.
 */
const withPluginHost = (source: string, plugins: readonly PluginHostOptions[]): string => {
  if (!source.includes(PLUGIN_ANCHOR)) {
    throw new Error(
      "blankTemplateFiles: cannot host a plugin — the hero's children are not where they were. " +
        'Update PLUGIN_ANCHOR in src/spaces/index.ts to match the declaration.'
    );
  }

  const asElement = plugins.every(plugin => plugin.as === 'element');
  const fed = plugins.flatMap(plugin => (plugin.data ? [plugin.data.query] : []));
  // As deep as the anchor sits: the declaration's own indentation, so the copy reads as written rather than reflowed.
  const indent = /^\s*/.exec(source.split('\n').find(line => line.includes(PLUGIN_ANCHOR)) ?? '')?.[0] ?? '';
  const pad = `${indent}  `;
  const comment = [
    `${plugins.length === 1 ? 'A component' : 'Components'} of YOUR OWN, rendered by the space.`,
    '',
    ...(asElement
      ? [
          "An element of a plugin's own type — what the builder adds when somebody drops the plugin on a page, and",
          'how a space that loads it from its manifest hosts it. Every attribute arrives in the component as a prop',
          'of the same name — written here, or bound to a source.'
        ]
      : [
          '`renderType` is the name it is registered under in `src/main.ts`; every other attribute arrives in',
          'the component as a prop of the same name — written here, or bound to a source. See',
          '`plitzi/README.md`.'
        ]),
    ...(fed.length > 0
      ? [
          '',
          `Its numbers come from \`public${fed.join('`, `public')}\`, read by the provider around it like any API: data a`,
          'project with no backend serves itself, rather than figures written into the page.'
        ]
      : [])
  ];
  const element = [
    'children: [',
    ...['heroEyebrow,', 'heroTitle,', 'heroLede,', 'heroActions,'].map(line => `${pad}${line}`),
    `${pad}/**`,
    ...comment.map(line => (line ? `${pad} * ${line}` : `${pad} *`)),
    `${pad} */`,
    `${pad}${plugins.map(plugin => hostSource(plugin, pad)).join(`,\n${pad}`)}`,
    `${indent}]`
  ].join('\n');

  const imports = [
    ...(fed.length > 0 ? ['apiContainer'] : []),
    ...(plugins.some(plugin => plugin.as !== 'element') ? ['custom'] : []),
    ...(plugins.some(plugin => plugin.as === 'element') ? ['element'] : [])
  ].join(', ');

  return `import { ${imports} } from '../../elements';\n${source.replace(PLUGIN_ANCHOR, element)}`;
};

/** Replaces one declared literal, and refuses to hand back a copy where it silently did not appear. */
const replaceLiteral = (source: string, field: string, from: string, to: string): string => {
  const declaration = `${field}: '${from}'`;
  if (!source.includes(declaration)) {
    throw new Error(
      `Cannot rename the copy — "${declaration}" is not in the template's source. ` +
        'The declaration changed shape; update src/spaces/index.ts to match it.'
    );
  }

  return source.replace(declaration, `${field}: ${stringLiteral(to)}`);
};

/**
 * The copy, under the receiver's name.
 *
 * `permanentUrl` is slugged rather than taken as given: it is a DNS label at the platform, and it is also what
 * every element id and style selector in the authored documents is derived from, so a project directory called
 * `My Site` has to become `my-site` here — before the documents carry it, not after.
 */
const renameSpace = (
  source: string,
  name: string,
  spec: Pick<SpaceSpec, 'name' | 'permanentUrl'> = blankSpaceSpec
): string => {
  const renamed = replaceLiteral(source, 'name', spec.name, name);

  return replaceLiteral(renamed, 'permanentUrl', spec.permanentUrl, slugify(name, 'space'));
};

/** Matches an import of this package's own modules — the only kind the copy has to be freed of. */
const RELATIVE_IMPORT = /^import (type )?\{([^}]*)\} from '\.\.[^']*';$/;

/** An import as one line, to read, and as it is written, to keep: a sibling's import travels as its formatter wrapped it. */
interface ImportStatement {
  text: string;
  written: string;
}

/** An import of a file beside this one, which travels with it: `./theme.ts`. */
const SIBLING_IMPORT = /from '\.\/[^']*';$/;

/**
 * The leading import block, one statement at a time.
 *
 * Line by line rather than by regex over the whole block, because the block's shape is not fixed: Prettier wraps
 * an import past 120 columns across several lines, and a single-line regex reads that as no import at all — while
 * the removal below still takes the lines away. The result was a copy missing the names it uses, which compiles
 * nowhere and is discovered by whoever generated a project, not by whoever changed the declaration.
 */
const leadingImports = (lines: string[]): { statements: ImportStatement[]; end: number } => {
  const statements: ImportStatement[] = [];
  let pending: string[] = [];
  let end = 0;

  for (const [index, line] of lines.entries()) {
    if (pending.length === 0 && line.trim() === '') {
      continue;
    }

    if (pending.length === 0 && !line.startsWith('import ')) {
      break;
    }

    pending.push(line);

    if (line.trimEnd().endsWith(';')) {
      statements.push({ text: pending.map(each => each.trim()).join(' '), written: pending.join('\n') });
      pending = [];
      end = index + 1;
    }
  }

  return { statements, end };
};

/** The width a scaffolded project formats to. */
const PRINT_WIDTH = 120;

/**
 * One import of the package, laid out the way the receiving project's formatter would lay it out.
 *
 * Wrapped one name per line past the print width, because a copy that fails its own project's lint on the first
 * `npm run lint` tells the person who just created it that something is already wrong.
 */
const importOf = (names: Set<string>, kind: '' | 'type '): string => {
  if (names.size === 0) {
    return '';
  }

  const sorted = [...names].sort();
  const line = `import ${kind}{ ${sorted.join(', ')} } from '@plitzi/sdk-authoring';`;

  return line.length <= PRINT_WIDTH
    ? line
    : `import ${kind}{\n${sorted.map(name => `  ${name}`).join(',\n')}\n} from '@plitzi/sdk-authoring';`;
};

export const toPortableSource = (source: string): string => {
  const lines = source.split('\n');
  const { statements, end } = leadingImports(lines);

  const values = new Set<string>();
  const types = new Set<string>();
  const kept: string[] = [];
  const siblings: string[] = [];
  const siblingTypes: string[] = [];

  for (const { text: statement, written } of statements) {
    const match = RELATIVE_IMPORT.exec(statement);
    if (!match) {
      if (statement.includes("from '..")) {
        throw new Error(
          `toPortableSource: cannot rewrite "${statement}". Only named imports of this package's own modules ` +
            "can be pointed at @plitzi/sdk-authoring; the template's declaration must use one."
        );
      }

      // A file beside this one travels with it, and is imported as it was; anything else — `node:path`, a
      // third-party package — travels with the copy untouched, ahead of the package's own import.
      if (SIBLING_IMPORT.test(statement)) {
        (statement.startsWith('import type ') ? siblingTypes : siblings).push(written);
      } else {
        kept.push(written);
      }

      continue;
    }

    const [, isType, names] = match;
    for (const entry of names
      .split(',')
      .map(name => name.trim())
      .filter(Boolean)) {
      (isType ? types : values).add(entry);
    }
  }

  // In the order the project's lint sorts them: packages, the files beside it, then the types of each.
  const header = [
    ...kept,
    importOf(values, ''),
    siblings.join('\n'),
    [importOf(types, 'type '), ...siblingTypes].filter(Boolean).join('\n')
  ]
    .filter(Boolean)
    .join('\n\n');

  const portable = [header, ...lines.slice(end)].join('\n');

  /**
   * Nothing climbs out of the folder, including from below the import block.
   *
   * A dynamic `import('../x')` or a re-export further down would resolve to nothing in the project the copy is
   * written into, and would do it at run time. Cheaper to refuse here than to ship a scaffold that fails on
   * somebody else's machine. A sibling (`./theme.ts`) is one of the files copied with it, and stays.
   */
  if (/from '\.(?:\.[/']|')/.test(portable)) {
    throw new Error(
      'toPortableSource: the copy still refers to a path relative to this package. A file copied into somebody ' +
        "else's project can only import from package names, or from the files copied beside it."
    );
  }

  return portable;
};

/** The name and address the catalog template is written under — what a copy under another name replaces. */
export const CATALOG_TEMPLATE_IDENTITY = { name: 'Catalog', permanentUrl: 'catalog' } as const;

/**
 * What a project with no server makes of the template's data: the file in `public/`, where the browser fetches it —
 * and so public, as everything there is — and the providers asking for it from the browser.
 */
const inBrowser = {
  data: (source: string): string =>
    source
      .replace("'../data/products.json'", "'../../public/data/products.json'")
      .replace(
        /\/\*\*\n \* How a page asks for the products[\s\S]*?\*\/\nexport const PRODUCTS = \{ query: '\/data\/products\.json', runtime: 'server' \} as const;/,
        "/**\n * How a page asks for the products: the browser fetches `public/data/products.json`, public as all of `public/` is.\n */\nexport const PRODUCTS = { query: '/data/products.json' } as const;"
      )
      .replace(
        "one JSON file of the project's own (`src/data/products.json`)",
        'one JSON file the project serves (`public/data/products.json`)'
      ),
  space: (source: string): string =>
    source.replace(
      "The products are `src/data/products.json`, the project's own: a provider on each page reads it on the server.",
      'The products are `public/data/products.json`, served by this project; a provider on each page fetches it.'
    )
};

/**
 * The catalog template as a project's files, by path: a shop with a layout, a product card, a home, a filtered
 * catalog and a page per product — a file per part, as a space bigger than one screen is written. Its data is the
 * project's own, `src/data/products.json`, read on the server; a project with no server (`mode: 'client'`) has it in
 * `public/data/`, fetched by the browser. The files are the template's own (`templates/catalog`), the ones its test
 * authors; they import `@plitzi/sdk-authoring` by name already, so the copy is the file.
 */
export const catalogTemplateFiles = ({
  name,
  mode = 'server'
}: { name?: string; mode?: 'server' | 'client' } = {}): Record<string, string> => {
  const client = mode === 'client';
  const space = name === undefined ? catalogSpace : renameSpace(catalogSpace, name, CATALOG_TEMPLATE_IDENTITY);
  const files: Record<string, string> = {
    'src/space/index.ts': client ? inBrowser.space(space) : space,
    'src/space/tokens.ts': catalogTokens,
    'src/space/data.ts': client ? inBrowser.data(catalogData) : catalogData,
    'src/space/layout.ts': catalogLayout,
    'src/space/components/productCard.ts': catalogCard,
    'src/space/pages/home.ts': catalogHomePage,
    'src/space/pages/catalog.ts': catalogCatalogPage,
    'src/space/pages/product.ts': catalogProductPage,
    'src/space/pages/notFound.ts': catalogNotFoundPage,
    [client ? 'public/data/products.json' : 'src/data/products.json']: catalogProducts
  };

  // This repository's lint wants single quotes even where a template quotes its own strings; a project's does not,
  // and would call the directive that quiets it unused.
  return Object.fromEntries(
    Object.entries(files).map(([path, source]) => [path, source.replace(/^\/\* eslint-disable quotes[^\n]*\*\/\n/, '')])
  );
};
