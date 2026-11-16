import type { SpaceCredentialProvider } from '../types';

/**
 * Every kind of credential a space keeps, as one list: what it signs in to, where its provider issues one and with
 * what permissions, and its fields — the builder's form draws it, its list labels each credential by it, and the server
 * judges a saved one against it (`credentialProblems`). A new kind is a value of `SpaceCredentialProvider` and its entry
 * here.
 */

export type CredentialGroup = 'api' | 'storage' | 'deploy' | 'email' | 'access';

export type CredentialField = {
  key: string;
  label: string;
  required: boolean;
  /** Typed as a password: never shown back, never trimmed. */
  secret?: boolean;
  example?: string;
  /** What to write, said under the field. */
  hint?: string;
  /** What a new credential starts with. */
  initial?: string;
  /** The values it takes, when it is a choice. */
  choices?: readonly { value: string; label: string }[];
  /** The shape its provider issues it in: a value of another shape is refused as it is saved, naming the shape. */
  format?: { pattern: RegExp; expected: string };
  /** Asked only when another field holds one value (a site password's user, when it is a user and a password). */
  when?: { key: string; is: string };
};

export type CredentialKind = {
  label: string;
  /** Font Awesome classes. */
  icon: string;
  group: CredentialGroup;
  /** What it signs in to, in one sentence. */
  purpose: string;
  /** Where its provider issues one, and what it must be allowed — in the provider's own words for its screens. */
  obtain?: { url?: string; steps: readonly string[] };
  /** Its fields; none for an open one, whose keys are its author's (a connector's `{{credential.<key>}}`). */
  fields: readonly CredentialField[];
};

export const CREDENTIAL_GROUPS: readonly { id: CredentialGroup; label: string }[] = [
  { id: 'api', label: 'APIs and content' },
  { id: 'storage', label: 'Storage' },
  { id: 'deploy', label: 'Deploys' },
  { id: 'email', label: 'Email' },
  { id: 'access', label: 'Site access' }
];

const KEY_PAIR_STEPS = 'Copy both values as soon as they are shown: the secret is shown only once.';

export const CREDENTIAL_KINDS: Readonly<Record<SpaceCredentialProvider, CredentialKind>> = {
  custom: {
    label: 'API, CMS or secret',
    icon: 'fa-solid fa-plug',
    group: 'api',
    purpose:
      'Named values of yours: the token a connector signs in to an API or a CMS with, or the secret a webhook is signed by.',
    obtain: {
      steps: [
        'Create a token in the API’s or the CMS’s settings (Strapi: Settings → API Tokens; Contentful: Settings → API keys).',
        'Give it only what the connector does: read, or read and write.'
      ]
    },
    fields: []
  },
  s3: {
    label: 'AWS',
    icon: 'fa-brands fa-aws',
    group: 'storage',
    purpose: 'An AWS access key: opens an S3 bucket of the space’s CDN, and deploys to S3, CloudFront or Amplify.',
    obtain: {
      url: 'https://console.aws.amazon.com/iam/home#/users',
      steps: [
        'In IAM, open a user meant for Plitzi (or create one) → Security credentials → Create access key.',
        'Allow it the bucket only: s3:ListBucket, s3:GetObject, s3:PutObject and s3:DeleteObject — plus cloudfront:UpdateDistribution and cloudfront:CreateInvalidation for CloudFront, or the app’s Amplify deployments.',
        KEY_PAIR_STEPS
      ]
    },
    fields: [
      {
        key: 'accessKeyId',
        label: 'Access Key ID',
        required: true,
        example: 'AKIAIOSFODNN7EXAMPLE',
        format: { pattern: /^[A-Z0-9]{16,128}$/u, expected: '16 to 128 upper-case letters and digits' }
      },
      {
        key: 'secretAccessKey',
        label: 'Secret Access Key',
        required: true,
        secret: true,
        format: { pattern: /^[A-Za-z0-9/+=]{40}$/u, expected: '40 characters' }
      }
    ]
  },
  r2: {
    label: 'Cloudflare R2',
    icon: 'fa-brands fa-cloudflare',
    group: 'storage',
    purpose: 'An R2 API token’s key pair: opens a bucket of the space’s CDN, and deploys to R2.',
    obtain: {
      url: 'https://dash.cloudflare.com/?to=/:account/r2/api-tokens',
      steps: [
        'In R2 → Manage API tokens → Create API token.',
        'Object Read & Write, applied to the bucket alone.',
        `${KEY_PAIR_STEPS} Use the S3 client’s pair, not the token value.`
      ]
    },
    fields: [
      {
        key: 'accessKeyId',
        label: 'Access Key ID',
        required: true,
        format: { pattern: /^[0-9a-f]{32}$/u, expected: '32 hexadecimal characters' }
      },
      {
        key: 'secretAccessKey',
        label: 'Secret Access Key',
        required: true,
        secret: true,
        format: { pattern: /^[0-9a-f]{64}$/u, expected: '64 hexadecimal characters' }
      }
    ]
  },
  github: {
    label: 'GitHub',
    icon: 'fa-brands fa-github',
    group: 'deploy',
    purpose: 'Commits the site to a repository’s branch that GitHub Pages serves.',
    obtain: {
      url: 'https://github.com/settings/personal-access-tokens/new',
      steps: [
        'Create a fine-grained personal access token.',
        'Repository access: only the site’s repository.',
        'Permissions: Contents — Read and write.'
      ]
    },
    fields: [{ key: 'token', label: 'Token', required: true, secret: true, example: 'github_pat_…' }]
  },
  cloudflare: {
    label: 'Cloudflare Pages',
    icon: 'fa-brands fa-cloudflare',
    group: 'deploy',
    purpose: 'Deploys the site to a Cloudflare Pages project.',
    obtain: {
      url: 'https://dash.cloudflare.com/profile/api-tokens',
      steps: [
        'Create Token → Create Custom Token.',
        'Permissions: Account → Cloudflare Pages → Edit, for the project’s account.',
        'The account ID is on the account’s home page, under API in the right-hand column.'
      ]
    },
    fields: [
      { key: 'apiToken', label: 'API token', required: true, secret: true },
      {
        key: 'accountId',
        label: 'Account ID',
        required: true,
        example: '023e105f4ecef8ad9ca31a8372d0c353',
        format: { pattern: /^[0-9a-f]{32}$/u, expected: '32 hexadecimal characters' }
      }
    ]
  },
  netlify: {
    label: 'Netlify',
    icon: 'fa-solid fa-diamond',
    group: 'deploy',
    purpose: 'Deploys the site to a Netlify site.',
    obtain: {
      url: 'https://app.netlify.com/user/applications#personal-access-tokens',
      steps: [
        'New access token, with an expiry you will renew.',
        'It reaches every site its account can: use an account meant for deploys when you can.'
      ]
    },
    fields: [{ key: 'token', label: 'Personal access token', required: true, secret: true, example: 'nfp_…' }]
  },
  vercel: {
    label: 'Vercel',
    icon: 'fa-solid fa-caret-up',
    group: 'deploy',
    purpose: 'Deploys the site to a Vercel project as its production deployment.',
    obtain: {
      url: 'https://vercel.com/account/settings/tokens',
      steps: ['Create a token.', 'Scope: the team the project belongs to — not Full Account.']
    },
    fields: [{ key: 'token', label: 'Token', required: true, secret: true }]
  },
  ftp: {
    label: 'FTP',
    icon: 'fa-solid fa-server',
    group: 'deploy',
    purpose: 'Uploads the site to a host over FTP — over TLS unless the host has none.',
    obtain: {
      steps: [
        'Your host’s control panel lists its FTP accounts (cPanel: Files → FTP Accounts).',
        'Use an account whose home is the site’s folder, so it reaches nothing else.'
      ]
    },
    fields: [
      { key: 'host', label: 'Host', required: true, example: 'ftp.example.com' },
      {
        key: 'port',
        label: 'Port',
        required: false,
        example: '21',
        format: { pattern: /^\d{1,5}$/u, expected: 'a port number' }
      },
      { key: 'user', label: 'User', required: true },
      { key: 'password', label: 'Password', required: true, secret: true },
      {
        key: 'secure',
        label: 'Security',
        required: false,
        initial: 'explicit',
        choices: [
          { value: 'explicit', label: 'TLS when connected (AUTH TLS, port 21)' },
          { value: 'implicit', label: 'TLS from the start (port 990)' },
          { value: 'none', label: 'None — the password travels in the clear' }
        ]
      }
    ]
  },
  smtp: {
    label: 'SMTP (email)',
    icon: 'fa-solid fa-envelope',
    group: 'email',
    purpose: 'The mail server a flow’s Send email step sends through.',
    obtain: {
      steps: [
        'Your email provider’s SMTP settings: Postmark, SendGrid, Amazon SES, Resend, or your own server.',
        'Gmail and Outlook need an app password, never the account’s own.'
      ]
    },
    fields: [
      { key: 'host', label: 'Host', required: true, example: 'smtp.example.com' },
      { key: 'port', label: 'Port', required: true, example: '587', initial: '587' },
      {
        key: 'security',
        label: 'Security',
        required: true,
        initial: 'starttls',
        choices: [
          { value: 'starttls', label: 'STARTTLS (usually 587)' },
          { value: 'tls', label: 'TLS (usually 465)' },
          { value: 'none', label: 'None' }
        ]
      },
      { key: 'username', label: 'User', required: false },
      { key: 'password', label: 'Password', required: false, secret: true },
      { key: 'fromEmail', label: 'Send as (email)', required: true, example: 'hello@example.com' },
      { key: 'fromName', label: 'Send as (name)', required: false, example: 'Acme' }
    ]
  },
  ssr: {
    label: 'Site password',
    icon: 'fa-solid fa-lock',
    group: 'access',
    purpose: 'Asks a domain’s visitors for a password before it shows them a page.',
    fields: [
      {
        key: 'type',
        label: 'Visitors enter',
        required: true,
        initial: 'basic',
        choices: [
          { value: 'basic', label: 'A user and a password' },
          { value: 'token', label: 'A token' }
        ]
      },
      {
        key: 'user',
        label: 'User',
        required: true,
        when: { key: 'type', is: 'basic' },
        format: { pattern: /^.{2,20}$/u, expected: '2 to 20 characters' }
      },
      {
        key: 'pass',
        label: 'Password',
        required: true,
        secret: true,
        when: { key: 'type', is: 'basic' },
        format: { pattern: /^.{2,50}$/u, expected: '2 to 50 characters' }
      },
      {
        key: 'token',
        label: 'Token',
        required: true,
        secret: true,
        when: { key: 'type', is: 'token' },
        format: { pattern: /^.{10,100}$/u, expected: '10 to 100 characters' }
      }
    ]
  }
};

export const isCredentialProvider = (value: unknown): value is SpaceCredentialProvider =>
  typeof value === 'string' && Object.hasOwn(CREDENTIAL_KINDS, value);

export type DeployCredentialKind = 'github' | 'cloudflare' | 'netlify' | 'vercel' | 'ftp';

/** A kind only deploy targets sign in with (an AWS key or an R2 pair also opens a CDN, so they are storage's). */
export const isDeployCredentialKind = (value: unknown): value is DeployCredentialKind =>
  isCredentialProvider(value) && CREDENTIAL_KINDS[value].group === 'deploy';
