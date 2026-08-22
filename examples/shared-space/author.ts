import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { offlineData } from './space';

/**
 * Writes the space out as JSON.
 *
 * The declaration is the source; this file exists because two examples cannot read it — one has no build step at
 * all and the others hand a PATH to an adapter that reads the file itself. Ids are derived from the declaration,
 * so re-running this on an unchanged space rewrites the same bytes, and `space.test.ts` fails if what is checked
 * in stops matching what the declaration produces.
 */
writeFileSync(fileURLToPath(new URL('./offline-data.json', import.meta.url)), `${JSON.stringify(offlineData(), null, 2)}\n`);
