import type { ActionCredential } from '../types';

/** Where a project's server — and `plitzi functions dev` — reads the credentials its space's code names. */
export const CREDENTIALS_ENV = 'PLITZI_CREDENTIALS';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const EXAMPLE = '{"google":{"clientId":"…","clientSecret":"…"}}';

/**
 * The credentials a deployment with no credential store keeps in its environment: one JSON object, credential id → its
 * keys, each a string — what `ctx.fetch({ credential })`, a connector and an `http.request` step name. Read whole or
 * refused with why: a value that does not read would otherwise leave every credential missing, and the integration
 * failing far from the cause.
 */
export const credentialsFromEnv = (env: NodeJS.ProcessEnv = process.env): Record<string, ActionCredential> => {
  const raw = env[CREDENTIALS_ENV];
  if (raw === undefined || raw.trim() === '') {
    return {};
  }

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (error) {
    throw new Error(`${CREDENTIALS_ENV} is not JSON: write one object, credential id → its keys — ${EXAMPLE}`, {
      cause: error
    });
  }

  if (!isRecord(value)) {
    throw new Error(`${CREDENTIALS_ENV} is one object, credential id → its keys — ${EXAMPLE}`);
  }

  return Object.fromEntries(
    Object.entries(value).map(([id, keys]) => {
      if (!isRecord(keys) || !Object.values(keys).every(key => typeof key === 'string')) {
        throw new Error(`${CREDENTIALS_ENV}: "${id}" is an object of strings, its keys by name — ${EXAMPLE}`);
      }

      return [id, Object.fromEntries(Object.entries(keys).map(([name, key]) => [name, String(key)]))];
    })
  );
};
