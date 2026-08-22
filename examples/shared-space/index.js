import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * The space as a file.
 *
 * The declaration in `space.ts` is the source — `yarn author` writes this JSON from it, and a test fails if the
 * two stop agreeing. What is here exists for the two ways of reading it that cannot run TypeScript: an example
 * with no build step at all, and the adapters that take a PATH and read the file themselves.
 */

/** Absolute path to the space, for adapters that read it themselves (`createJsonAdapters` takes a path). */
export const offlineDataPath = fileURLToPath(new URL('./offline-data.json', import.meta.url));

/** The space as `{ schema, style }` — the shape every Plitzi renderer consumes. */
export const readOfflineData = () => JSON.parse(readFileSync(offlineDataPath, 'utf-8'));
