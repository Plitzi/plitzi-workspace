import type { PluginDeclaration } from './ComponentTypes';

// Mutable channel written during the React SSR render and read back by the server to shape the HTTP
// response (status, redirect, extra headers). Passed by reference as a prop so it crosses the
// server/SDK bundle boundary without relying on a shared React context instance.
export type SSRRenderResult = {
  status?: number;
  redirect?: string;
  headers?: Record<string, string>;
};

/**
 * How a plugin's build reaches the page.
 *
 * `copy`, `compile` and `download` all end with a file on this server's disk, which is also what lets the SSR
 * render import the component and put its output in the HTML. `cdn` deliberately does not: the published URL is
 * handed straight to the browser and the plugin renders on the client only.
 *
 * That trade is worth taking for a plugin this server did not build. Importing a third-party bundle into the
 * render process means the bundle's own copy of React runs inside the renderer, and two copies of React is an
 * invalid hook call — a crash that takes the whole page down rather than the one component.
 */
export type PluginAction = 'copy' | 'compile' | 'download' | 'cdn';

export type PluginSourceFile<T = Record<string, unknown>> = {
  js: string;
  css?: string;
  action?: PluginAction;
  version?: string;
  props?: T;
};

export type PluginSourceComponent<T = Record<string, unknown>> = {
  component: unknown;
  js?: string;
  css?: string;
  version?: string;
  props?: T;
};

export type PluginSource<T = Record<string, unknown>> = PluginSourceFile<T> | PluginSourceComponent<T>;

export type PluginEntry = {
  name: string;
  /** JS-safe identifier for the import statement (hyphens/dots replaced with underscores, no @version). */
  varName: string;
  /** SDK lookup key used as the object property (base name without @version). */
  keyName: string;
  /** Browser-facing URL served by the SSR server (e.g. /sdk-plugins/name@ver/index.js). */
  js?: string;
  /** Absolute filesystem path used for server-side dynamic import() during SSR. */
  filePath?: string;
  css?: string;
  props: Record<string, unknown>;
  /**
   * Whether the SSR render actually included this plugin's own output.
   *
   * False for a plugin served straight from its CDN, and for one whose server-side import failed. Either way the
   * client must not render it on the hydration pass: the markup would not be in the document React is hydrating
   * against, and the mismatch throws away the whole tree it happens in.
   */
  ssr?: boolean;
  /**
   * What the plugin declares, when this page draws none of its types: its code and stylesheet are left out of the
   * document and loaded when a page that draws it is opened. Absent, the page loads it up front.
   */
  deferred?: PluginDeclaration;
};

/** What a space token is worth. `render` is the public credential every published site embeds — it is readable
 *  by anyone who views the page, so it may only read, and only from the origins it declares. `host` is that same
 *  read access for a SERVER that renders the space as its own (self-hosting): secret rather than published, since
 *  a server has no browser origin for the allowlist to check. `agent` is the delegated grant an MCP connector
 *  receives after a member consents, and is the only bearer that may write without a session behind it. */
export type SpaceScope = 'render' | 'agent' | 'host';

export type SSRUser = {
  token: string; // e.g. JWT or opaque token from auth provider
  /** Unix seconds the token dies at, so the rendered page can renew ahead of it rather than on a refusal. */
  expiresAt?: number;
  id: number;
  username: string;
  email: string;
  verified: boolean;
  permissions: string[];
  roles: string[];
};

/**
 * Who a run is for, as the session named them — without the session: what a step, a function and a job see of the
 * person, and what a job keeps of whoever started it, for every slice it runs after their session is gone.
 */
export type RunUser = Pick<SSRUser, 'id' | 'username' | 'email' | 'verified' | 'permissions' | 'roles'>;
