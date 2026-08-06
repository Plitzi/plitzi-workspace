import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Absolute path to the space, for adapters that read it themselves (`createJsonAdapters` takes a path). */
export const offlineDataPath = fileURLToPath(new URL('./offline-data.json', import.meta.url));

/** The space as `{ schema, style }` — the shape every Plitzi renderer consumes. */
export const readOfflineData = () => JSON.parse(readFileSync(offlineDataPath, 'utf-8'));
