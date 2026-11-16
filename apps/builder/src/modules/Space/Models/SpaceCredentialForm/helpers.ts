import { z } from 'zod';

import {
  CREDENTIAL_GROUPS,
  CREDENTIAL_KINDS,
  credentialData,
  credentialProblems,
  isCredentialProvider
} from '@plitzi/sdk-shared/credentials';

import type { SpaceCredentialProvider } from '@plitzi/sdk-shared';
import type { CredentialGroup } from '@plitzi/sdk-shared/credentials';

/**
 * A credential as the form holds it: its name, what it signs in to, and its values by field — judged by
 * `credentialProblems`, the rule the server refuses a save with, so a value this form accepts is one the platform keeps.
 */
export const spaceCredentialFormSchema = z
  .object({
    name: z.string().trim().min(2, 'A name of at least 2 characters'),
    provider: z.custom<SpaceCredentialProvider>(isCredentialProvider, 'Choose what it signs in to'),
    data: z.record(z.string(), z.string())
  })
  .superRefine((values, ctx) => {
    credentialProblems(values.provider, values.data).forEach(({ key, message }) =>
      ctx.addIssue({ code: 'custom', path: key ? ['data', key] : ['data'], message })
    );
  });

export type SpaceCredentialFormValues = z.infer<typeof spaceCredentialFormSchema>;

/**
 * What a new credential of a kind starts as: named after its provider with its fields' first values — or, an open kind
 * being whatever its author makes it (a Strapi token, a webhook's secret), unnamed with one value to fill in.
 */
export const initialValues = (provider: SpaceCredentialProvider, name?: string): SpaceCredentialFormValues => {
  const { label, fields } = CREDENTIAL_KINDS[provider];

  return {
    name: name ?? (fields.length > 0 ? label : ''),
    provider,
    data: fields.length > 0 ? Object.fromEntries(fields.map(field => [field.key, field.initial ?? ''])) : { token: '' }
  };
};

/** The credential's values as the API keeps them. */
export const credentialDataOf = (values: SpaceCredentialFormValues): Record<string, string> =>
  credentialData(values.provider, values.data);

/** The kinds offered, in the catalogue's groups and order: every kind, or those the caller can use. */
export const offeredGroups = (
  providers?: SpaceCredentialProvider[]
): { id: CredentialGroup; label: string; providers: SpaceCredentialProvider[] }[] => {
  const offered = (Object.keys(CREDENTIAL_KINDS) as SpaceCredentialProvider[]).filter(
    // `Object.keys` widens the record's keys to string; they are its providers.
    provider => !providers?.length || providers.includes(provider)
  );

  return CREDENTIAL_GROUPS.map(group => ({
    ...group,
    providers: offered.filter(provider => CREDENTIAL_KINDS[provider].group === group.id)
  })).filter(group => group.providers.length > 0);
};
