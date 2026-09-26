import { readFileSync, statSync, writeFileSync } from 'node:fs';

import { serverLog } from '../helpers/serverLog';

import type { OfflineDataRaw, SSRPageAdapters, SSRRequest, SSRSpaceDeployment } from '@plitzi/sdk-shared';

/**
 * Where a space comes from, and nothing else. Who is looking at it is `createAuthAdapters` (or the auth kernel's
 * own `ssrAdapters`) — a deployment composes the two with a spread, and swaps either without disturbing the other.
 */
export type JsonAdaptersConfig = {
  /**
   * The space: a path to a `{ schema, style }` JSON, a function returning one per request, or the data itself for a
   * consumer that already holds it (composed at startup, fetched once, built in a test). Only a path can be written
   * back to, so `saveOfflineData` is offered only when one was given.
   */
  offlineData: OfflineDataRaw | string | ((spaceId: number, environment: string, revision?: number) => string);
  deployment?: string | SSRSpaceDeployment | Record<string, SSRSpaceDeployment>;
};

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
  const pathFor = (spaceId: number, environment: string, revision?: number): string | undefined => {
    if (typeof config.offlineData === 'function') {
      return config.offlineData(spaceId, environment, revision);
    }

    return typeof config.offlineData === 'string' ? config.offlineData : undefined;
  };

  const getOfflineData = (
    spaceId: number,
    environment: string,
    revision?: number
  ): Promise<OfflineDataRaw | undefined> => {
    try {
      const filePath = pathFor(spaceId, environment, revision);
      if (!filePath) {
        return Promise.resolve(config.offlineData as OfflineDataRaw);
      }

      return Promise.resolve(json.read(filePath) as OfflineDataRaw);
    } catch (err: unknown) {
      serverLog.error('JsonAdapters', 'Failed to read offlineData', err);

      return Promise.resolve(undefined);
    }
  };

  const saveOfflineData = (spaceId: number, environment: string, data: OfflineDataRaw): Promise<void> => {
    const filePath = pathFor(spaceId, environment);
    if (!filePath) {
      return Promise.resolve();
    }

    writeFileSync(filePath, JSON.stringify(data, null, 2));
    json.forget(filePath);

    return Promise.resolve();
  };

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
  // an absent adapter means the capability is absent, rather than one that throws when somebody finds it.
  const canSave = typeof config.offlineData !== 'object';

  return {
    getOfflineData,
    getSpaceDeployment,
    ...(canSave ? { saveOfflineData } : {})
  };
};
