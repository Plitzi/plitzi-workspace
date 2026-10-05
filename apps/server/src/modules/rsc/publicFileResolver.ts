import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { PROJECT_DATA_PREFIX } from '@plitzi/sdk-shared/server/rsc/projectData';

import type { RscElementResolver } from './resolveRscData';
import type { SpaceRevision } from '@plitzi/sdk-shared';

/** Where a provider's `query` is a path: a URL, a protocol-relative one or one with `{{tokens}}` is not. */
const pathOf = (query: unknown): string | undefined => {
  if (typeof query !== 'string' || !query.startsWith('/') || query.startsWith('//') || query.includes('{{')) {
    return undefined;
  }

  try {
    return decodeURIComponent(query.split(/[?#]/)[0]);
  } catch {
    return undefined;
  }
};

/**
 * A server provider whose `query` names a JSON file under `prefix`, read from the same path inside `folder` and handed
 * to the render — answered in the shape a browser request publishes, `{ status, data }`, so a provider reads
 * `<source>.data.<field>` whichever runtime it has. A path outside `prefix`, or one that climbs out of the folder, is
 * not this resolver's, and the element is left as it was; a file not there, or not JSON, is the provider's error state.
 */
const fileResolver = (folder: string, prefix: string): RscElementResolver => {
  const root = path.resolve(folder);

  return async ({ element, signal }) => {
    const pathname = pathOf(element.attributes.query);
    if (pathname === undefined || !pathname.startsWith(prefix)) {
      return undefined;
    }

    const file = path.resolve(root, `.${pathname.slice(prefix.length - 1)}`);
    if (!file.startsWith(`${root}${path.sep}`)) {
      return undefined;
    }

    try {
      const data: unknown = JSON.parse(await readFile(file, { encoding: 'utf8', signal }));

      return { status: 200, data };
    } catch {
      return null;
    }
  };
};

/**
 * A server provider whose `query` is a file this server serves from `publicDir` — `/hours.json` — read from disk, so
 * the page arrives with the section in it rather than fetching in the browser what the server already has. The same
 * bytes the browser would have fetched.
 */
export const publicFileResolver = (publicDir: string): RscElementResolver => fileResolver(publicDir, '/');

/**
 * A server provider whose `query` is `/data/<file>`, read from `dataDir` — the project's own data, which is never
 * served as a file: nobody downloads the folder. What the provider reads is in the page it renders.
 */
export const dataFileResolver = (dataDir: string): RscElementResolver => fileResolver(dataDir, PROJECT_DATA_PREFIX);

/**
 * A server provider whose `query` is `/data/<file>`, answered from the space's own data as Plitzi keeps it — of the
 * version being rendered, read off the same deployment record an action's run is (`req.ctx.spaceDeployment`), so a
 * published page reads the data it was published with. What `dataFileResolver` is for a folder, for a platform.
 */
export const dataLookupResolver = (
  getData: (spaceId: number, at: SpaceRevision) => Promise<Record<string, string> | undefined>
): RscElementResolver => {
  return async ({ element, spaceId, environment, req }) => {
    const pathname = pathOf(element.attributes.query);
    if (pathname === undefined || !pathname.startsWith(PROJECT_DATA_PREFIX)) {
      return undefined;
    }

    const deployment = req.ctx.spaceDeployment;
    const files = await getData(spaceId, {
      environment: deployment?.environment ?? environment,
      revision: deployment?.revision ?? 0
    });
    const text = files?.[pathname.slice(PROJECT_DATA_PREFIX.length)];
    if (text === undefined) {
      return null;
    }

    try {
      const data: unknown = JSON.parse(text);

      return { status: 200, data };
    } catch {
      return null;
    }
  };
};
