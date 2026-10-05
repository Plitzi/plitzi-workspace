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
 * ```
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PROJECT_DATA_PREFIX } from '@plitzi/sdk-shared/server/rsc/projectData';

import { compactSvg } from './svg/compactSvg';

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

export { compactSvg } from './svg/compactSvg';
