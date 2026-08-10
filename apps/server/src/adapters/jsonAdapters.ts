import { readFileSync, writeFileSync } from 'node:fs';

import type { OfflineDataRaw, SSRAdapters, SSRRequest, SSRSpaceDeployment } from '@plitzi/sdk-shared';

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

const readJson = (filePath: string): unknown => JSON.parse(readFileSync(filePath, 'utf-8'));

export const createJsonAdapters = (config: JsonAdaptersConfig): SSRAdapters => {
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

      return Promise.resolve(readJson(filePath) as OfflineDataRaw);
    } catch (err: unknown) {
      console.error('[JsonAdapters] Failed to read offlineData:', (err as Error).message);

      return Promise.resolve(undefined);
    }
  };

  const saveOfflineData = (spaceId: number, environment: string, data: OfflineDataRaw): Promise<void> => {
    const filePath = pathFor(spaceId, environment);
    if (!filePath) {
      return Promise.resolve();
    }

    writeFileSync(filePath, JSON.stringify(data, null, 2));

    return Promise.resolve();
  };

  const getSpaceDeployment = (req: SSRRequest): Promise<SSRSpaceDeployment> => {
    const { deployment } = config;

    if (!deployment) {
      return Promise.resolve({ spaceId: 1, environment: 'main', revision: 0 });
    }

    if (typeof deployment === 'string') {
      try {
        return Promise.resolve(readJson(deployment) as SSRSpaceDeployment);
      } catch (err: unknown) {
        console.error('[JsonAdapters] Failed to read deployment file:', (err as Error).message);
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
