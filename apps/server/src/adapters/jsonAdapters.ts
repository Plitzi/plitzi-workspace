import { readFileSync } from 'node:fs';

import type { SSRAdapters, SSRRequest, SSRSpaceDeployment } from '../types';
import type { OfflineDataRaw } from '@plitzi/sdk-shared';

export type JsonAdaptersConfig = {
  offlineData: string | ((spaceId: number, environment: string, revision?: number) => string);
  deployment?: string | SSRSpaceDeployment | Record<string, SSRSpaceDeployment>;
};

const isDeploymentObject = (v: NonNullable<JsonAdaptersConfig['deployment']>): v is SSRSpaceDeployment =>
  typeof v === 'object' && ('spaceId' in v || 'environment' in v || 'error' in v);

const readJson = (filePath: string): unknown => JSON.parse(readFileSync(filePath, 'utf-8'));

export const createJsonAdapters = (config: JsonAdaptersConfig): SSRAdapters => {
  const getOfflineData = (
    spaceId: number,
    environment: string,
    revision?: number
  ): Promise<OfflineDataRaw | undefined> => {
    try {
      const filePath =
        typeof config.offlineData === 'function'
          ? config.offlineData(spaceId, environment, revision)
          : config.offlineData;
      return Promise.resolve(readJson(filePath) as OfflineDataRaw);
    } catch (err: unknown) {
      console.error('[JsonAdapters] Failed to read offlineData:', (err as Error).message);
      return Promise.resolve(undefined);
    }
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

  return { getOfflineData, getSpaceDeployment };
};
