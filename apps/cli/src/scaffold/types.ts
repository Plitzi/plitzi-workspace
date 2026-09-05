/** The three package managers a generated project can be spoken to in. */
export type PackageManager = 'npm' | 'yarn' | 'pnpm';

/** Where the space comes from, and whether there is a server in the picture. The two decisions, and the only two. */
export interface CreateAnswers {
  name: string;
  /** `server` renders on a Node tier (SSR + RSC); `client` renders in the browser with no server at all. */
  mode: 'server' | 'client';
  /** `local` carries the space in the project; `cloud` reads the live one out of Plitzi. */
  source: 'local' | 'cloud';
  /** Cloud only: the self-hosting key (server) or the public render key (client). */
  key: string;
  environment: string;
  /**
   * Which package manager the project is written for.
   *
   * Not a third decision — it changes no file's meaning — but it is written into every command the project
   * quotes at somebody, and into the one file Yarn needs to install the way the other two already do.
   */
  packageManager: PackageManager;
}

/** Every file of the generated project, by the path it is written to. */
export type ProjectFiles = Record<string, string>;
