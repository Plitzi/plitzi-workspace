/**
 * What a deploy is made of, whatever builds it and wherever it goes (RFC 0034): a site is a list of files at paths
 * relative to its root, and a provider is what puts that list somewhere a visitor's browser reaches.
 */

/** One file of a site: where it is served from (no leading slash), what it holds and how it is served. */
export interface SiteFile {
  path: string;
  body: Uint8Array;
  /** Its media type, as the host should answer it (`contentTypeOf`). */
  type: string;
  /**
   * How long a browser may keep it: `immutable` for a file whose name changes with its content (the SDK's, the fonts),
   * `revalidate` for one at a fixed address (`index.html`), which must be asked for again after every deploy.
   */
  cache: 'immutable' | 'revalidate';
}

/** A line of a deploy's log, said as it happens. Every write a provider makes says what it did; nothing is silent. */
export type DeployLog = (line: string, level?: 'info' | 'warn' | 'error') => void;

/** What a provider answers once the site is where it goes. */
export interface UploadResult {
  /** Files written (or found already there, by digest). */
  files: number;
  bytes: number;
  /** Where the site can be seen now, when the provider says (a deploy's own address on Netlify, Vercel, Pages). */
  url?: string;
  /** The provider's own name for this deploy (a commit, a deploy id, the prefix written), to go back to it. */
  reference?: string;
}

/** Puts a site somewhere: one per provider, given its credential and settings by whoever builds it. */
export interface SiteUploader {
  /** Its name in a log: `S3 bucket acme-site`, `GitHub acme/site@gh-pages`. */
  readonly name: string;
  /** Whether the switch to the new site is one step a visitor never sees half-done (§6 "Atomic switch"). */
  readonly atomic: boolean;
  upload: (files: SiteFile[], log: DeployLog, signal?: AbortSignal) => Promise<UploadResult>;
}

/** The versions a build bakes in (RFC 0034 §5.2): what the site runs until it is deployed again. */
export interface BuildVersions {
  /** `@plitzi/plitzi-sdk`. */
  sdk: string;
  react: string;
  /** `@plitzi/sdk-server`, which built it. */
  sdkServer: string;
}

/**
 * What a build baked in, part by part, each a digest: two builds of the same revision for the same target agree on every
 * part, and the parts that differ are the reasons a target needs a deploy ("the fonts changed, the SDK is newer").
 */
export type FingerprintParts = Record<string, string>;

/** A site ready to upload: its files, what each part of it was built from, and the versions it runs. */
export interface BuiltSite {
  files: SiteFile[];
  fingerprint: { digest: string; parts: FingerprintParts };
  versions: BuildVersions;
}
