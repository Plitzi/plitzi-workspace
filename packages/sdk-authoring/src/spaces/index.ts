/* eslint-disable quotes */
import { authorSpace, slugify } from '../schema';
import { space as blankSpaceSpec } from './blank/spec';
// The declaration's own source, inlined at build time — the copy `plitzi create` writes into a project. Read as
// text rather than through the filesystem because this package is bundled for the browser too.
import specSource from './blank/spec.ts?raw';

import type { AuthoredSpace } from '../schema';

/**
 * The declaration itself, under the name the platform knows it by.
 *
 * It is exported from its own file as `space`, because that file is copied verbatim into projects created with
 * `plitzi create` — and there, `blankSpaceSpec` would be a puzzle: the developer is looking at their own site,
 * not at Plitzi's blank one. Renamed here rather than rewritten on the way out, so the copy is the file.
 */
export { space as blankSpaceSpec } from './blank/spec';

/**
 * The space a new space starts as — one page with a hero and six guides into the docs, not an empty document.
 *
 * It lives here rather than in the seeds of whichever server happens to create spaces, because two unrelated
 * things need it and they must not drift: the platform's `POST /spaces`, and `plitzi create`, which scaffolds a
 * project around it for somebody who has no account at all. When it was JSON inside one of them, the other kept a
 * copy — and a copy of a fixture is a fixture that is wrong six months later with nothing to say so.
 *
 * A declaration rather than an exported document, so whoever receives it can change it. `blankSpace()` is the
 * documents a renderer wants; `blankSpaceSource()` is the file itself, for a project that will edit it.
 */

/** The two documents, authored fresh — so one caller writing its own name in cannot mark the next one's copy. */
export const blankSpace = (): AuthoredSpace => authorSpace(blankSpaceSpec);

/**
 * The declaration as a file somebody can drop into their own project, optionally under a name of its own.
 *
 * The source is this package's own — the same text that produced the documents above, so what a project starts
 * with and what Plitzi creates cannot come apart. Its imports are relative here because it lives inside the
 * package; on the way out they are rewritten to the package name, which is how the copy resolves anywhere else.
 *
 * The rename lives here, and not in the scaffold that asks for it, for the reason the whole function exists: a
 * caller renaming the copy would have to know which literals this file happens to contain, and a caller that
 * knows that is a caller that breaks silently the day one of them changes. Here the literals are read off
 * `blankSpaceSpec`, so they cannot be out of date, and a rename that finds nothing to replace throws.
 */
export interface BlankSpaceSourceOptions {
  /** The name the copy carries. `permanentUrl` follows it, slugged. */
  name?: string;
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

export const blankSpaceSource = (options: BlankSpaceSourceOptions = {}): string => {
  const { name, plugin } = options;
  const plugins = plugin === undefined ? [] : Array.isArray(plugin) ? plugin : [plugin];
  const portable = toPortableSource(plugins.length > 0 ? withPluginHost(specSource, plugins) : specSource);

  return name === undefined ? portable : renameSpace(portable, name);
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
        `  children: [${host(`${pad}  `)}]`,
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
      "blankSpaceSource: cannot host a plugin — the hero's children are not where they were. " +
        'Update PLUGIN_ANCHOR in src/spaces/index.ts to match the declaration.'
    );
  }

  const asElement = plugins.every(plugin => plugin.as === 'element');
  const fed = plugins.flatMap(plugin => (plugin.data ? [plugin.data.query] : []));
  const element = `children: [
            heroEyebrow,
            heroTitle,
            heroLede,
            heroActions,
            /**
             * ${plugins.length === 1 ? 'A component' : 'Components'} of YOUR OWN, rendered by the space.
             *${
               asElement
                 ? `
             * An element of a plugin's own type — what the builder adds when somebody drops the plugin on a page, and
             * how a space that loads it from its manifest hosts it. Every attribute arrives in the component as a prop
             * of the same name — written here, or bound to a source.`
                 : `
             * \`renderType\` is the name it is registered under in \`src/main.ts\`; every other attribute arrives in
             * the component as a prop of the same name — written here, or bound to a source. See
             * \`src/plugins/README.md\`.`
             }${
               fed.length > 0
                 ? `
             *
             * Its numbers come from \`public${fed.join('`, `public')}\`, read by the provider around it like any API: data a
             * project with no backend serves itself, rather than figures written into the page.`
                 : ''
             }
             */
            ${plugins.map(plugin => hostSource(plugin, '            ')).join(',\n            ')}
          ]`;

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
      `blankSpaceSource: cannot rename the copy — "${declaration}" is not in the blank space's source. ` +
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
const renameSpace = (source: string, name: string): string => {
  const renamed = replaceLiteral(source, 'name', blankSpaceSpec.name, name);

  return replaceLiteral(renamed, 'permanentUrl', blankSpaceSpec.permanentUrl, slugify(name, 'space'));
};

/** Matches an import of this package's own modules — the only kind the copy has to be freed of. */
const RELATIVE_IMPORT = /^import (type )?\{([^}]*)\} from '\.\.[^']*';$/;

/**
 * The leading import block, one statement at a time.
 *
 * Line by line rather than by regex over the whole block, because the block's shape is not fixed: Prettier wraps
 * an import past 120 columns across several lines, and a single-line regex reads that as no import at all — while
 * the removal below still takes the lines away. The result was a copy missing the names it uses, which compiles
 * nowhere and is discovered by whoever generated a project, not by whoever changed the declaration.
 */
const leadingImports = (lines: string[]): { statements: string[]; end: number } => {
  const statements: string[] = [];
  let pending: string[] = [];
  let end = 0;

  for (const [index, line] of lines.entries()) {
    if (pending.length === 0 && line.trim() === '') {
      continue;
    }

    if (pending.length === 0 && !line.startsWith('import ')) {
      break;
    }

    pending.push(line.trim());

    if (line.trimEnd().endsWith(';')) {
      statements.push(pending.join(' '));
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

  for (const statement of statements) {
    const match = RELATIVE_IMPORT.exec(statement);
    if (!match) {
      // An import of something else — `node:path`, a third-party package — travels with the copy untouched.
      if (statement.includes("from '..")) {
        throw new Error(
          `toPortableSource: cannot rewrite "${statement}". Only named imports of this package's own modules ` +
            "can be pointed at @plitzi/sdk-authoring; the blank space's declaration must use one."
        );
      }

      kept.push(statement);
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

  const header = [...kept, importOf(values, ''), importOf(types, 'type ')].filter(Boolean).join('\n\n');

  const portable = [header, ...lines.slice(end)].join('\n');

  /**
   * Nothing relative survives, including from below the import block.
   *
   * A dynamic `import('../x')` or a re-export further down would resolve to nothing in the project the copy is
   * written into, and would do it at run time. Cheaper to refuse here than to ship a scaffold that fails on
   * somebody else's machine.
   */
  if (/from '\.\.?[/']/.test(portable)) {
    throw new Error(
      'toPortableSource: the copy still refers to a path relative to this package. A file copied into somebody ' +
        "else's project can only import from package names."
    );
  }

  return portable;
};
