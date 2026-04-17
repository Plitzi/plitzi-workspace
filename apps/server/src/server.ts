/**
 * Standalone entry point.
 *
 * Reads configuration from environment variables and starts the SSR server
 * using stub adapters.  In production this file is replaced (or augmented) by
 * a consumer that provides real adapter implementations.
 *
 * You can run this directly for local development:
 *
 *   node --import tsx --watch src/server.ts
 */

import { createSSRServer } from './core/createServer';

import type { SSRAdapters, SSRRequest, SSRSpaceDeployment } from './types';
import type { OfflineDataRaw } from '@plitzi/sdk-shared';

const PORT = parseInt(process.env.SSR_PORT ?? '3001', 10);
const HOST = process.env.SSR_HOST ?? '0.0.0.0';

// ── Stub adapters ─────────────────────────────────────────────────────────────
// Replace these with real implementations (e.g. backed by MongoDB + MySQL) or
// pass them at runtime when consuming this package as a library.

const getOfflineData = async (
  _spaceId: number,
  _environment: string,
  _revision?: number
): Promise<OfflineDataRaw | undefined> => {
  console.warn('[SSR] getOfflineData: using stub adapter — returning undefined');
  return undefined;
};

const getSpaceDeployment = async (_req: SSRRequest): Promise<SSRSpaceDeployment> => {
  console.warn('[SSR] getSpaceDeployment: using stub adapter — returning spaceId=1');
  return { spaceId: 1, environment: 'main', revision: 0 };
};

const adapters: SSRAdapters = { getOfflineData, getSpaceDeployment };

const server = createSSRServer({
  port: PORT,
  host: HOST,
  sdkEnvironment: (process.env.SDK_ENVIRONMENT as 'production' | 'staging' | 'development') ?? 'production',
  devMode: process.env.NODE_ENV !== 'production',
  adapters
});

server.listen(PORT, HOST);
