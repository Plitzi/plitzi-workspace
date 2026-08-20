import type { ActionCredential } from '../types';
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
 * Redacts every secret the run has actually resolved, wherever it appears, at any depth.
 *
 * Keyed on the VALUES rather than on field names, because a secret does not stay in the field it came from: it
 * travels into a header a node built, into an error a provider echoed back, and from there into the trace and the
 * log. Matching names would redact the one place it was already safe.
 *
 * It learns as the run goes rather than being built up front from a declared list. That is what makes dropping
 * the declaration safe: a credential is registered the moment the task that needed it resolved one, which is
 * always before that task's own result is redacted — and what was never resolved was never at risk.
 */
export const createRedactor = () => {
  const secrets = new Set<string>();

  const redactString = (value: string) => {
    let output = value;
    for (const secret of secrets) {
      output = output.split(secret).join('«redacted»');
    }

    return output;
  };

  const redact = <T>(value: T): T => {
    if (secrets.size === 0) {
      return value;
    }

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

  return {
    /** Everything long enough to be a secret rather than a flag. Short values would redact ordinary text. */
    add: (credential: ActionCredential) => {
      Object.values(credential).forEach(value => {
        if (typeof value === 'string' && value.length >= 8) {
          secrets.add(value);
        }
      });
    },
    redact
  };
};
