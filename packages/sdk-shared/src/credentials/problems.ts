import { CREDENTIAL_KINDS } from './kinds';
import { readSmtpCredential } from '../actions/smtp';

import type { SpaceCredentialProvider } from '../types';
import type { CredentialField } from './kinds';

/** What is wrong with one field of a credential, said by the field's label — or `''` for the credential as a whole. */
export type CredentialProblem = { key: string; message: string };

/** A signed token pasted where a key belongs — the most likely mix-up, and worth naming as such. */
const looksLikeToken = (value: string): boolean => value.split('.').length === 3 && value.length > 100;

const fieldProblem = (field: CredentialField, raw: unknown): string | undefined => {
  const text = typeof raw === 'string' ? (field.secret ? raw : raw.trim()) : typeof raw === 'number' ? String(raw) : '';
  if (!text) {
    return field.required ? `${field.label} is required` : undefined;
  }

  if (field.choices && !field.choices.some(choice => choice.value === text)) {
    return `${field.label} is one of ${field.choices.map(choice => choice.value).join(', ')}`;
  }

  if (field.format && !field.format.pattern.test(text)) {
    const found = looksLikeToken(text) ? 'a signed token, not a key' : `${String(text.length)} characters`;

    return `${field.label} is ${field.format.expected}; this one is ${found}`;
  }

  return undefined;
};

/**
 * What keeps a credential from being used, field by field — nothing when it is whole: the one judgement the builder's
 * form shows beside each field and the server refuses a save with. A field with a problem of its own is said once;
 * what a kind checks beyond its fields (an SMTP server, by the rule `email.send` applies) is said for the rest.
 */
export const credentialProblems = (
  provider: SpaceCredentialProvider,
  data: Record<string, unknown>
): CredentialProblem[] => {
  const kind = CREDENTIAL_KINDS[provider];
  if (kind.fields.length === 0) {
    const keys = Object.entries(data);
    if (keys.length === 0) {
      return [{ key: '', message: 'It holds at least one value, under the name its connector reads it by' }];
    }

    return keys.flatMap(([key, value]) =>
      typeof value === 'string' && value !== '' ? [] : [{ key, message: `${key} has no value` }]
    );
  }

  const problems = kind.fields.flatMap(field => {
    const message = fieldProblem(field, data[field.key]);

    return message ? [{ key: field.key, message }] : [];
  });

  if (provider === 'smtp') {
    const said = new Set(problems.map(problem => problem.key));
    problems.push(...readSmtpCredential(data).problems.filter(problem => !said.has(problem.key)));
  }

  return problems;
};

/** A credential's values as they are kept: the fields it asks, text trimmed (a secret as typed), empty ones left out. */
export const credentialData = (
  provider: SpaceCredentialProvider,
  values: Record<string, string>
): Record<string, string> => {
  const kind = CREDENTIAL_KINDS[provider];
  if (kind.fields.length === 0) {
    return Object.fromEntries(
      Object.entries(values).flatMap(([key, value]) => (key.trim() ? [[key.trim(), value]] : []))
    );
  }

  return Object.fromEntries(
    kind.fields.flatMap(field => {
      const raw = values[field.key] ?? '';
      const value = field.secret ? raw : raw.trim();

      return value ? [[field.key, value]] : [];
    })
  );
};
