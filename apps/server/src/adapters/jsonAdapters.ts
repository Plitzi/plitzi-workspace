import { readFileSync, statSync, writeFileSync } from 'node:fs';

import { serverLog } from '../helpers/serverLog';

import type {
  OfflineDataRaw,
  Schema,
  SSRPageAdapters,
  SSRRequest,
  SSRSpaceDeployment,
  Style
} from '@plitzi/sdk-shared';

/**
 * Where a space comes from, and nothing else. Who is looking at it is `createAuthAdapters` (or the auth kernel's
 * own `ssrAdapters`) — a deployment composes the two with a spread, and swaps either without disturbing the other.
 */
export type JsonAdaptersConfig = {
  /**
   * The space: a path to a `{ schema, style }` JSON, the data itself for a consumer that already holds it (composed at
   * startup, fetched once, built in a test), or a function answering either per request — a path per space, or the
   * documents a process holds and replaces while it runs (a project re-authoring its space on a save). Only a path can
   * be written back to: `saveSchema` and `saveStyle` are not offered for the data itself, and refuse a function's
   * answer that is not a path.
   */
  offlineData: OfflineDataRaw | string | OfflineDataSource;
  deployment?: string | SSRSpaceDeployment | Record<string, SSRSpaceDeployment>;
};

/** Where the space a request asks for is: a JSON file's path, or the documents themselves. */
export type OfflineDataSource = (spaceId: number, environment: string, revision?: number) => string | OfflineDataRaw;

const isDeploymentObject = (v: NonNullable<JsonAdaptersConfig['deployment']>): v is SSRSpaceDeployment =>
  typeof v === 'object' && ('spaceId' in v || 'environment' in v || 'error' in v);

// Parsed once per version of the file rather than per request, which was a tenth of a render's CPU on a real space.
// Every request shares the parsed object, as it does the one `createCloudAdapters` holds.
const createJsonReader = () => {
  const held = new Map<string, { mtimeMs: number; size: number; value: unknown }>();

  return {
    read: (filePath: string): unknown => {
      const { mtimeMs, size } = statSync(filePath);
      const hit = held.get(filePath);
      if (hit?.mtimeMs === mtimeMs && hit.size === size) {
        return hit.value;
      }

      const value: unknown = JSON.parse(readFileSync(filePath, 'utf-8'));
      held.set(filePath, { mtimeMs, size, value });

      return value;
    },
    forget: (filePath: string): void => {
      held.delete(filePath);
    }
  };
};

export const createJsonAdapters = (config: JsonAdaptersConfig): SSRPageAdapters => {
  const json = createJsonReader();
  const sourceFor = (spaceId: number, environment: string, revision?: number): string | OfflineDataRaw =>
    typeof config.offlineData === 'function' ? config.offlineData(spaceId, environment, revision) : config.offlineData;

  const getOfflineData = (
    spaceId: number,
    environment: string,
    revision?: number
  ): Promise<OfflineDataRaw | undefined> => {
    try {
      const source = sourceFor(spaceId, environment, revision);

      // The file's text is what the server wrote or somebody exported: read as the documents it holds.
      return Promise.resolve(typeof source === 'string' ? (json.read(source) as OfflineDataRaw) : source);
    } catch (err: unknown) {
      serverLog.error('JsonAdapters', 'Failed to read offlineData', err);

      return Promise.resolve(undefined);
    }
  };

  // The MCP reads and writes the schema and the style as separate documents; here both live in the one file.
  const getSchema = async (spaceId: number, environment: string): Promise<Schema | undefined> =>
    (await getOfflineData(spaceId, environment))?.schema;

  const getStyle = async (spaceId: number, environment: string): Promise<Style | undefined> =>
    (await getOfflineData(spaceId, environment))?.style;

  const writeBack = (spaceId: number, environment: string, change: Partial<OfflineDataRaw>): Promise<void> => {
    const filePath = sourceFor(spaceId, environment);
    if (typeof filePath !== 'string') {
      return Promise.reject(
        new Error(
          `Space ${String(spaceId)} (${environment}) is held in memory, not in a file: there is nowhere to save it.`
        )
      );
    }

    const current = json.read(filePath) as OfflineDataRaw;
    writeFileSync(filePath, JSON.stringify({ ...current, ...change }, null, 2));
    json.forget(filePath);

    return Promise.resolve();
  };

  const saveSchema = (spaceId: number, environment: string, schema: Schema): Promise<void> =>
    writeBack(spaceId, environment, { schema });

  const saveStyle = (spaceId: number, environment: string, style: Style): Promise<void> =>
    writeBack(spaceId, environment, { style });

  const getSpaceDeployment = (req: SSRRequest): Promise<SSRSpaceDeployment> => {
    const { deployment } = config;

    if (!deployment) {
      return Promise.resolve({ spaceId: 1, environment: 'main', revision: 0 });
    }

    if (typeof deployment === 'string') {
      try {
        return Promise.resolve(json.read(deployment) as SSRSpaceDeployment);
      } catch (err: unknown) {
        serverLog.error('JsonAdapters', 'Failed to read deployment file', err);

        return Promise.resolve({ error: { code: 500, message: 'Deployment config unreadable' } });
      }
    }

    if (isDeploymentObject(deployment)) {
      return Promise.resolve(deployment);
    }

    const byHostname = deployment as Record<string, SSRSpaceDeployment | undefined>;

    return Promise.resolve(
      byHostname[req.hostname] ?? byHostname['*'] ?? { spaceId: 1, environment: 'main', revision: 0 }
    );
  };

  // No path, nowhere to write: the adapter is simply not offered, which is the same rule everything else follows —
  // an absent adapter means the capability is absent. A function may answer a path, so it is offered, and refuses
  // the space it answers held in memory.
  const canSave = typeof config.offlineData !== 'object';

  return {
    getOfflineData,
    getSpaceDeployment,
    getSchema,
    getStyle,
    ...(canSave ? { saveSchema, saveStyle } : {})
  };
};
