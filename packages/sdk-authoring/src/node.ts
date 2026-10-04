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
 * ```
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

export { compactSvg } from './svg/compactSvg';
