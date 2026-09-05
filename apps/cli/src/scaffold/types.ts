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
}

/** Every file of the generated project, by the path it is written to. */
export type ProjectFiles = Record<string, string>;
