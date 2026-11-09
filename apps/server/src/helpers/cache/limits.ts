import { DEFAULT_CACHE_BYTES, DEFAULT_TTL_MS } from './defaults';

import type { SSRPageServerConfig } from '../../types';

/** What the deployment's environment may say of the caches when its code says nothing. */
export const CACHE_ENV = {
  maxBytes: 'SDK_SERVER_CACHE_MAX_BYTES',
  storeMaxBytes: 'SDK_SERVER_CACHE_STORE_MAX_BYTES'
} as const;

const UNITS: Record<string, number> = { '': 1, b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 };

/**
 * A size as the environment writes it — `134217728`, `128MB`, `2GB` — or nothing when it says none. Refused when it is
 * not one, naming the variable: a typo that read as no limit would be a cache with none.
 */
export const bytesFromEnvironment = (
  name: string,
  environment: NodeJS.ProcessEnv = process.env
): number | undefined => {
  const raw = environment[name]?.trim();
  if (raw === undefined || raw === '') {
    return undefined;
  }

  const match = /^(\d+(?:\.\d+)?)\s*([kmg]?b?)$/i.exec(raw);
  const unit = match ? UNITS[match[2].toLowerCase()] : undefined;
  if (!match || unit === undefined || Number(match[1]) <= 0) {
    throw new Error(`${name} must be a size in bytes, or with a unit: 134217728, 128MB, 2GB — got "${raw}"`);
  }

  return Math.round(Number(match[1]) * unit);
};

/** What one process keeps of pages, and for how long past their TTL: the config, else the environment, else the default. */
export const cacheLimitsOf = (
  config: Pick<SSRPageServerConfig, 'cache'>,
  environment: NodeJS.ProcessEnv = process.env
): { maxBytes: number; staleMs: number } => ({
  maxBytes: config.cache?.maxBytes ?? bytesFromEnvironment(CACHE_ENV.maxBytes, environment) ?? DEFAULT_CACHE_BYTES.html,
  staleMs: config.cache?.staleMs ?? DEFAULT_TTL_MS.stale
});
