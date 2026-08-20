import type { ActionCredential, ActionLookups } from '../types';
import type { ActionField, ActionFieldType, SSRUser } from '@plitzi/sdk-shared';

const coerce = (type: ActionFieldType, value: unknown): unknown => {
  switch (type) {
    case 'number': {
      const parsed = typeof value === 'number' ? value : Number(value);

      return Number.isFinite(parsed) ? parsed : undefined;
    }

    case 'boolean': {
      if (typeof value === 'boolean') {
        return value;
      }

      return value === 'true' ? true : value === 'false' ? false : undefined;
    }

    case 'json': {
      if (typeof value !== 'string') {
        return value;
      }

      try {
        return JSON.parse(value) as unknown;
      } catch {
        return undefined;
      }
    }

    case 'text':
    case 'date':
    case 'file':
    default:
      return typeof value === 'object' && value !== null ? undefined : String(value);
  }
};

export type FieldValidation = { values: Record<string, unknown>; missing: string[]; invalid: string[] };

/**
 * Coerces a value bag against declared fields.
 *
 * Undeclared keys are DROPPED rather than passed through, and this is what makes twig-in-params safe: every token
 * a node interpolates resolves against values that survived a contract someone wrote down. A pass-through bag
 * would let a caller inject whatever a template happens to reference.
 */
export const applyFields = (fields: Record<string, ActionField>, raw: Record<string, unknown>): FieldValidation => {
  const values: Record<string, unknown> = {};
  const missing: string[] = [];
  const invalid: string[] = [];

  Object.entries(fields).forEach(([key, field]) => {
    const provided: unknown = raw[key] ?? field.defaultValue;
    if (provided === undefined || provided === null || provided === '') {
      if (field.required) {
        missing.push(key);
      }

      return;
    }

    const coerced = coerce(field.type, provided);
    if (coerced === undefined) {
      invalid.push(key);

      return;
    }

    values[key] = coerced;
  });

  return { values, missing, invalid };
};

/** The visitor as a flow sees them. The token is deliberately absent — see the `auth.currentUser` task. */
export const projectUser = (user?: SSRUser) => {
  if (!user) {
    return undefined;
  }

  const { id, username, email, verified, permissions, roles } = user;

  return { id, username, email, verified, permissions, roles };
};

/**
 * Resolves the credentials a document declared, and only those.
 *
 * Resolved once, up front, and the run fails closed when a declared identifier is missing: a template that
 * silently interpolates an empty secret sends an unauthenticated request to a customer's backend and reports
 * whatever that backend says about it, which is a far worse diagnostic than "credential not found".
 */
export const resolveCredentials = async (
  lookups: ActionLookups,
  spaceId: number,
  declared: string[] = []
): Promise<Record<string, ActionCredential>> => {
  if (declared.length === 0 || !lookups.getCredential) {
    return {};
  }

  const entries = await Promise.all(
    declared.map(async identifier => [identifier, await lookups.getCredential?.(spaceId, identifier)] as const)
  );

  return entries.reduce<Record<string, ActionCredential>>((acum, [identifier, credential]) => {
    if (!credential) {
      throw new Error(`Credential "${identifier}" is not available for this space`);
    }

    acum[identifier] = credential;

    return acum;
  }, {});
};

/**
 * Replaces every resolved secret value wherever it appears, at any depth.
 *
 * Keyed on the VALUES rather than on field names, because a secret does not stay in the field it came from: it
 * travels into a header a node built, into an error a provider echoed back, and from there into the trace and the
 * log. Matching names would redact the one place it was already safe.
 */
export const buildRedactor = (credentials: Record<string, ActionCredential>) => {
  const secrets = Object.values(credentials)
    .flatMap(credential => Object.values(credential))
    .filter(secret => typeof secret === 'string' && secret.length >= 8);

  if (secrets.length === 0) {
    return <T>(value: T): T => value;
  }

  const redactString = (value: string) =>
    secrets.reduce<string>((acum, secret) => acum.split(secret).join('«redacted»'), value);

  const redact = <T>(value: T): T => {
    if (typeof value === 'string') {
      return redactString(value) as T;
    }

    if (Array.isArray(value)) {
      return (value as unknown[]).map(item => redact(item)) as T;
    }

    if (value !== null && typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>(
        (acum, [key, item]) => {
          acum[key] = redact(item);

          return acum;
        },
        {}
      );

      return entries as T;
    }

    return value;
  };

  return redact;
};
