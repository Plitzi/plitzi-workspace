/**
 * What a deploy provider's credential holds (RFC 0034 §6), field by field: the one list the builder's credential form
 * draws and the server checks a saved one against. A provider that signs in with a credential of a new kind adds its
 * kind here, and both read it.
 */

export type DeployCredentialKind = 'github' | 'cloudflare' | 'netlify' | 'vercel' | 'ftp';

export type DeployCredentialField = {
  key: string;
  label: string;
  required: boolean;
  /** Typed as a password: never shown back. */
  secret?: boolean;
  example?: string;
  hint?: string;
  /** The values it takes, when it is a choice. */
  choices?: readonly { value: string; label: string }[];
};

export const DEPLOY_CREDENTIALS: Readonly<
  Record<DeployCredentialKind, { label: string; fields: readonly DeployCredentialField[] }>
> = {
  github: {
    label: 'GitHub',
    fields: [
      {
        key: 'token',
        label: 'Token',
        required: true,
        secret: true,
        example: 'github_pat_…',
        hint: 'A fine-grained token with Contents: read and write on the repository'
      }
    ]
  },
  cloudflare: {
    label: 'Cloudflare',
    fields: [
      { key: 'apiToken', label: 'API token', required: true, secret: true, hint: 'With Cloudflare Pages: Edit' },
      { key: 'accountId', label: 'Account ID', required: true, example: '023e105f4ecef8ad9ca31a8372d0c353' }
    ]
  },
  netlify: {
    label: 'Netlify',
    fields: [{ key: 'token', label: 'Personal access token', required: true, secret: true }]
  },
  vercel: {
    label: 'Vercel',
    fields: [{ key: 'token', label: 'Token', required: true, secret: true, hint: 'Scoped to the project’s team' }]
  },
  ftp: {
    label: 'FTP',
    fields: [
      { key: 'host', label: 'Host', required: true, example: 'ftp.example.com' },
      { key: 'port', label: 'Port', required: false, example: '21' },
      { key: 'user', label: 'User', required: true },
      { key: 'password', label: 'Password', required: true, secret: true },
      {
        key: 'secure',
        label: 'Security',
        required: false,
        choices: [
          { value: 'explicit', label: 'TLS when connected (AUTH TLS, port 21)' },
          { value: 'implicit', label: 'TLS from the start (port 990)' },
          { value: 'none', label: 'None — the password travels in the clear' }
        ]
      }
    ]
  }
};

export const isDeployCredentialKind = (value: unknown): value is DeployCredentialKind =>
  typeof value === 'string' && Object.hasOwn(DEPLOY_CREDENTIALS, value);

/** What is missing from a deploy credential's values, by the field's label: nothing when it is whole. */
export const deployCredentialProblems = (kind: DeployCredentialKind, values: Record<string, unknown>): string[] =>
  DEPLOY_CREDENTIALS[kind].fields.flatMap(field => {
    const value = values[field.key];
    const text = typeof value === 'string' ? value.trim() : '';
    if (field.required && !text) {
      return [`${field.label} is required`];
    }

    if (text && field.choices && !field.choices.some(choice => choice.value === text)) {
      return [`${field.label} is one of ${field.choices.map(choice => choice.value).join(', ')}`];
    }

    return [];
  });
