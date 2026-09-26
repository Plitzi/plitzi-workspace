import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { sampleId } from '../spaces';

import type { SSRRscContext, SSRRscData } from '@plitzi/sdk-shared';

/** What every server rendering the sample space needs beside it: its plugins, and the RSC slices its server
 *  elements read. Shared by the suite's own server and the one spread over several processes. */

const here = path.dirname(fileURLToPath(import.meta.url));

export const plugins = {
  serverInfo: { js: path.resolve(here, 'plugins/ServerProbe.tsx'), action: 'compile' as const },
  clientInfo: { js: path.resolve(here, 'plugins/ClientProbe.tsx'), action: 'compile' as const },
  sharedInfo: { js: path.resolve(here, 'plugins/SharedProbe.tsx'), action: 'compile' as const }
};

/** Fixed values, not timestamps: a spec asserting on `renderedAt` would be asserting on the clock.
 *
 *  Keyed by the ELEMENT ID, which is what the runtime looks a slice up by — an authored space derives those, so
 *  they are resolved from the name the space gave the element rather than written down. */
const SLICES: Record<string, unknown> = {
  [sampleId('rsc-server')]: { message: 'from the server', nodeVersion: process.version },
  [sampleId('rsc-shared')]: { message: 'from both' }
};

// eslint-disable-next-line @typescript-eslint/require-await
export const getRscData = async ({ ids }: SSRRscContext): Promise<SSRRscData> => ({
  serverData: ids?.length ? Object.fromEntries(ids.filter(id => id in SLICES).map(id => [id, SLICES[id]])) : SLICES
});
