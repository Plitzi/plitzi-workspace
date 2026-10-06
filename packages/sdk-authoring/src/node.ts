/**
 * What only an author running on Node can do: read the project's own files. A separate entry, so the package's main
 * one stays what it is — data and functions over data, for a browser as much as a build script.
 *
 * ```ts
 * import { svgFile, svgFiles } from '@plitzi/sdk-authoring/node';
 *
 * const logos = svgFiles(new URL('./logos/', import.meta.url));   // { stripe: '<svg…>', shopify: '<svg…>' }
 * svg(logos.stripe, { label: 'Stripe' });
 * svg(svgFile(new URL('./icons/arrow.svg', import.meta.url)));
 *
 * authorSpace(space, { data: publicData(new URL('../public/', import.meta.url)) });   // bindings held to the files
 * authorSpace(space, { serverData: projectData(new URL('./data/', import.meta.url)) }); // …and read on the server only
 * authorSpace(space, await projectAuthoring(new URL('..', import.meta.url)));            // all of a CLI project's
 * ```
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';
import {
  DATA_DIR,
  PLUGIN_MANIFEST_FILE,
  PLUGINS_DIR,
  PUBLIC_DIR,
  VENDOR_PLUGINS_DIR
} from '@plitzi/sdk-shared/project/paths';
import { PROJECT_DATA_PREFIX } from '@plitzi/sdk-shared/server/rsc/projectData';

import { compactSvg } from './svg/compactSvg';

import type { PluginDeclarationData } from './schema/types';

const pathOf = (where: string | URL): string => (where instanceof URL ? fileURLToPath(where) : where);

/** One SVG file, compacted (`compactSvg`) — what `svg()` takes. Refused, with its path, when it is not an SVG. */
export const svgFile = (file: string | URL): string => {
  const at = pathOf(file);
  const markup = compactSvg(readFileSync(at, 'utf-8'));
  if (!/^<svg[\s>]/i.test(markup)) {
    throw new Error(`${at} is not an SVG: it does not start with <svg> once its prolog and comments are taken out.`);
  }

  return markup;
};

/**
 * Every `.svg` in a folder, by its name without the extension — a set of logos or icons kept as files rather than as
 * strings in the space's source, where they were most of its bytes and nothing an author reads.
 */
export const svgFiles = (folder: string | URL): Record<string, string> => {
  const at = pathOf(folder);

  return Object.fromEntries(
    readdirSync(at)
      .filter(name => name.toLowerCase().endsWith('.svg'))
      .sort()
      .map(name => [path.basename(name, path.extname(name)), svgFile(path.join(at, name))])
  );
};

/** A JSON file under `prefix`, read once from the same path inside `folder`; `undefined` for anything else. */
const fileReader = (folder: string | URL, prefix: string): ((query: string) => unknown) => {
  const root = path.resolve(pathOf(folder));
  const read = new Map<string, unknown>();

  return query => {
    if (!query.startsWith(prefix) || query.startsWith('//') || query.includes('{{')) {
      return undefined;
    }

    const file = path.resolve(root, `.${query.split(/[?#]/)[0].slice(prefix.length - 1)}`);
    if (!file.startsWith(`${root}${path.sep}`)) {
      return undefined;
    }

    if (!read.has(file)) {
      let value: unknown;
      try {
        value = JSON.parse(readFileSync(file, 'utf-8'));
      } catch {
        value = undefined;
      }

      read.set(file, value);
    }

    return read.get(file);
  };
};

/**
 * What a provider's `query` answers when it is a JSON file the project serves — `/data/plans.json` read from `public/` —
 * for `authorSpace`'s `data`: every binding onto that provider is then held to the file. Anything else — another site,
 * a path with `{{tokens}}`, one that climbs out of the folder, a file that is not there or not JSON — is `undefined`,
 * and left unchecked. Each file is read once.
 */
export const publicData = (folder: string | URL): ((query: string) => unknown) => fileReader(folder, '/');

/**
 * What a provider's `/data/<file>` query answers from the project's own data — `src/data/`, which its server reads and
 * never serves (`dataDir`) — for `authorSpace`'s `serverData`: bindings are held to the file, and a provider reading
 * one from the browser is refused.
 */
export const projectData = (folder: string | URL): ((query: string) => unknown) =>
  fileReader(folder, PROJECT_DATA_PREFIX);

/** The file a plugin folder declares itself in, as `plitzi add plugin` writes it. */
const DECLARATION_FILE = 'declaration.ts';

/**
 * The declaration of every plugin under `folder` — `src/plugins/<Name>/declaration.ts`, its default export — for
 * `authorSpace`'s `plugins`: what each fires, answers and reads. Found by folder, as the server finds the plugins
 * themselves, so a plugin is declared by being there and no list can forget one. A folder without the file is a
 * component and nothing else; one whose default export is not a declaration is refused, naming the file. In folder
 * order, so the same folders always author the same space.
 */
export const pluginDeclarations = async (folder: string | URL): Promise<PluginDeclarationData[]> => {
  const root = pathOf(folder);
  const files = existsSync(root)
    ? readdirSync(root, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => path.join(root, entry.name, DECLARATION_FILE))
        .filter(file => existsSync(file))
        .sort()
    : [];

  return Promise.all(
    files.map(async file => {
      const loaded: unknown = await import(pathToFileURL(file).href);
      const declaration: unknown =
        typeof loaded === 'object' && loaded !== null && 'default' in loaded ? loaded.default : undefined;
      if (
        typeof declaration !== 'object' ||
        declaration === null ||
        !('type' in declaration) ||
        typeof declaration.type !== 'string'
      ) {
        throw new Error(`${file} exports no declaration by default: \`export default { type: '…', … }\`.`);
      }

      // A record with its `type`: `authorSpace` checks every other field, and says which is wrong.
      return declaration as PluginDeclarationData;
    })
  );
};

/** The manifest of a plugin run as it was built, read; nothing when it cannot be — the server says why when it boots. */
const manifestOf = (file: string): Record<string, unknown> => {
  try {
    const manifest: unknown = JSON.parse(readFileSync(file, 'utf-8'));

    return isRecord(manifest) ? manifest : {};
  } catch {
    return {};
  }
};

/**
 * The element types of the plugins a project runs as they were built (`vendor/plugins/<type>/`, a project made from a
 * space): each folder's type and every element its manifest provides (`pluginSchema`). None in most projects.
 */
const builtPluginTypes = (folder: string): string[] =>
  existsSync(folder)
    ? readdirSync(folder, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .sort((a, b) => a.name.localeCompare(b.name))
        .flatMap(entry => {
          const { pluginSchema } = manifestOf(path.join(folder, entry.name, PLUGIN_MANIFEST_FILE));

          return [entry.name, ...(isRecord(pluginSchema) ? Object.keys(pluginSchema) : [])];
        })
    : [];

/** What a project `@plitzi/cli` writes checks its space against: the part of `authorSpace`'s options its files say. */
export type ProjectAuthoring = {
  plugins: PluginDeclarationData[];
  pluginTypes: string[];
  serverData?: (query: string) => unknown;
  data: (query: string) => unknown;
};

/**
 * What `authorSpace` checks the space of a project `@plitzi/cli` writes against, read from the project at `root` — so
 * its server, `npm run author` and the CLI's checks hold the space to the same thing:
 *
 * - `plugins`: every plugin folder's declaration (`src/plugins/<Name>/declaration.ts`, `pluginDeclarations`);
 * - `pluginTypes`: the element types of the plugins it runs as they were built (`vendor/plugins/`);
 * - `serverData`: the project's own data, which only its server reads (`src/data/`, `projectData`) — a server-mode
 *   project's; one with no server has no such folder, and its providers read `public/data/` from the browser;
 * - `data`: the JSON files it serves (`public/`, `publicData`).
 *
 * A folder the project does not have is nothing to check against. `root` is the project's folder — from `src/main.ts`
 * or `plitzi/author.ts`, `new URL('..', import.meta.url)`, which holds for a compiled `dist/main.js` too.
 *
 * ```ts
 * authorSpace(space, await projectAuthoring(new URL('..', import.meta.url)));
 * ```
 */
export const projectAuthoring = async (root: string | URL): Promise<ProjectAuthoring> => {
  const at = pathOf(root);
  const serverData = path.join(at, DATA_DIR);

  return {
    plugins: await pluginDeclarations(path.join(at, PLUGINS_DIR)),
    pluginTypes: builtPluginTypes(path.join(at, VENDOR_PLUGINS_DIR)),
    ...(existsSync(serverData) ? { serverData: projectData(serverData) } : {}),
    data: publicData(path.join(at, PUBLIC_DIR))
  };
};

export { compactSvg } from './svg/compactSvg';
