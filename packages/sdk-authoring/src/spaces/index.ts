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
 * The space a new space starts as — one page with a hero and four cards, not an empty document.
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
   * Add a `custom` element hosting a plugin the receiver supplies.
   *
   * Off by default, and it has to be: the platform authors a new space from this same declaration and hosts none
   * of anybody's plugins, so a `custom` element in it would render "Custom Component … Not Found" on every space
   * anyone ever signed up for. It is on for `plitzi create`, where the project being scaffolded carries the
   * component and registers it — which is the one fact about Plitzi a page of built-in elements cannot show.
   */
  plugin?: { renderType: string; id: string; settings: Record<string, unknown> };
}

export const blankSpaceSource = (options: BlankSpaceSourceOptions = {}): string => {
  const { name, plugin } = options;
  const portable = toPortableSource(plugin ? withPluginHost(specSource, plugin) : specSource);

  return name === undefined ? portable : renameSpace(portable, name);
};

/** The one line in the declaration a `custom` element is hung off — the hero, so it lands under the title. */
const PLUGIN_ANCHOR = 'children: [heading({ id: \'hero-title\', content: \'Welcome To Plitzi\', subType: \'h1\' })]';

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
const withPluginHost = (source: string, plugin: NonNullable<BlankSpaceSourceOptions['plugin']>): string => {
  if (!source.includes(PLUGIN_ANCHOR)) {
    throw new Error(
      'blankSpaceSource: cannot host a plugin — the hero\'s children are not where they were. ' +
        'Update PLUGIN_ANCHOR in src/spaces/index.ts to match the declaration.'
    );
  }

  const settings = JSON.stringify(plugin.settings).replace(/\\/g, '\\\\').replace(/'/g, '\\\'');

  const element = `children: [
            heading({ id: 'hero-title', content: 'Welcome To Plitzi', subType: 'h1' }),
            /**
             * A component of YOUR OWN, rendered by the space.
             *
             * \`renderType\` is the name it is registered under in \`src/main.ts\`; everything else on this
             * element arrives in the component as a prop of the same name, which is what lets a data source be
             * pointed at it later without a line of plumbing. See \`src/plugins/README.md\`.
             */
            custom({
              id: '${plugin.id}',
              renderType: '${plugin.renderType}',
              settings: '${settings}',
              css: { desktop: { 'margin-top': '24px', 'z-index': '1' } }
            })
          ]`;

  return `import { custom } from '../../elements';\n${source.replace(PLUGIN_ANCHOR, element)}`;
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

  return source.replace(declaration, `${field}: '${to}'`);
};

/**
 * The copy, under the receiver's name.
 *
 * `permanentUrl` is slugged rather than taken as given: it is a DNS label at the platform, and it is also what
 * every element id and style selector in the authored documents is derived from, so a project directory called
 * `My Site` has to become `my-site` here — before the documents carry it, not after.
 */
const renameSpace = (source: string, name: string): string => {
  const renamed = replaceLiteral(source, 'name', blankSpaceSpec.name, name.replace(/'/g, '\\\''));

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
      if (statement.includes('from \'..')) {
        throw new Error(
          `toPortableSource: cannot rewrite "${statement}". Only named imports of this package's own modules ` +
            'can be pointed at @plitzi/sdk-authoring; the blank space\'s declaration must use one.'
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

  const header = [
    ...kept,
    values.size > 0 ? `import { ${[...values].sort().join(', ')} } from '@plitzi/sdk-authoring';` : '',
    types.size > 0 ? `import type { ${[...types].sort().join(', ')} } from '@plitzi/sdk-authoring';` : ''
  ]
    .filter(Boolean)
    .join('\n\n');

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
        'else\'s project can only import from package names.'
    );
  }

  return portable;
};
