import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { RscElementResolver } from './resolveRscData';

/**
 * A server provider whose `query` is a file this server serves from `publicDir` — `/data/home.json` — read from disk
 * and handed to the render, so the page arrives with the section in it.
 *
 * A project with no backend keeps its data in `public/data/*.json`, and an `apiContainer` fetching it from the browser
 * leaves the server-rendered page without those sections: a flash of nothing, no content for a crawler, and no
 * anchor in place for `/#section` to land on. Read here, it is the same bytes the browser would have fetched.
 *
 * Only a plain path inside `publicDir`: a URL, one that climbs out of the folder, or one with `{{tokens}}` (resolved
 * in the browser against the visitor's route and state) is not this resolver's, and the element is left as it was.
 */
export const publicFileResolver = (publicDir: string): RscElementResolver => {
  const root = path.resolve(publicDir);

  return async ({ element, signal }) => {
    const query: unknown = element.attributes.query;
    if (typeof query !== 'string' || !query.startsWith('/') || query.startsWith('//') || query.includes('{{')) {
      return undefined;
    }

    let pathname: string;
    try {
      pathname = decodeURIComponent(query.split(/[?#]/)[0]);
    } catch {
      return undefined;
    }

    const file = path.resolve(root, `.${pathname}`);
    if (!file.startsWith(`${root}${path.sep}`)) {
      return undefined;
    }

    try {
      const data: unknown = JSON.parse(await readFile(file, { encoding: 'utf8', signal }));

      return data;
    } catch {
      // Not there, or not JSON: the provider renders its error state as it would have in the browser.
      return null;
    }
  };
};
