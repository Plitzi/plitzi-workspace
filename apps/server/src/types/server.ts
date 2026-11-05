import type { SSRTemplateProps } from '@plitzi/sdk-kernel/types';
import type { OfflineDataRaw, PluginSource } from '@plitzi/sdk-shared';
import type { FC } from 'react';

/**
 * Remote pictures this server fetches, resizes and keeps, at `/_plitzi/img`.
 *
 * A picture from a dozen other sites, some 1500 px wide for a 360 px card, is the heaviest part of most pages; with
 * this on, an `image` whose `src` is another site's offers the browser a `srcset` of sizes this server makes — in
 * AVIF or WebP when the browser takes them, and with `sharp` installed (without it the picture is passed through,
 * still cached).
 */
export type SSRImagesConfig = {
  /**
   * The hosts a picture may come from: `images.example.com`, or `*.example.com` for every subdomain. Nothing else is
   * fetched — the endpoint is otherwise a way to make this server download anything — and each address is also held
   * to the rule every outbound request is (no private network, every redirect judged).
   */
  domains: readonly string[];
  /** Where the resized files are kept. Default: `tmp/images` under the working directory. */
  cacheDir?: string;
};

/**
 * How a store-relative font path becomes a URL a browser can fetch.
 *
 * A space's manifest stores paths, never absolute URLs: the same space is rendered by Plitzi's cloud from a CDN,
 * by a self-hosted server from its own disk, and by a static export from wherever it was published to. Baking one
 * of those origins into the document would send every other deployment asking Plitzi for its customer's fonts.
 */
export type SSRFontsConfig = {
  /** Prefix joined to each path, e.g. `/fonts` or `https://cdn.example.com/fonts`. Default: `/fonts`. */
  baseUrl?: string;
  /**
   * A directory this server serves the uploaded files from, under `/fonts/*`.
   *
   * The self-hosting answer, and the reason `baseUrl` defaults to a path rather than an origin: with a directory
   * here a deployment needs no object storage, no credentials and no network to serve its customers' fonts. A
   * cloud deployment leaves it out and points `baseUrl` at its CDN instead.
   */
  dir?: string;
  /**
   * A page's Google families, served from this server's own origin (`/_plitzi/fonts/google/…`) rather than Google's:
   * the stylesheet and the files it names ride the page's connection, and the visitor's address is not handed to a
   * third party for a typeface. Asked of Google once each and kept in this process, within `maxBytes` (32 MB by
   * default). On unless `false`, which links Google itself. A page whose server cannot reach Google is sent there.
   */
  google?: false | { maxBytes?: number };
};

export type SSRPlugin = {
  component: FC;
  props: Record<string, unknown>;
};

export type SSRTemplateFn = (params: SSRTemplateProps & { html: string; offlineData: string }) => string;

/** Which surfaces a page server mounts. Only what the page pipeline itself owns: the MCP endpoint and
 *  draft-preview are stages a companion package hands in, so they are not flags here. */
export type ServerServices = {
  ssr?: boolean;
  rsc?: boolean;
};

export type PluginRegistry = {
  register: (name: string, source: PluginSource) => void;
  /** A plugin no longer there — its folder removed under a dev server: never built or served again. */
  unregister: (name: string) => void;
  invalidate: (name?: string, version?: string) => Promise<void>;
};

export type CacheFilter = {
  spaceId?: number;
  environment?: string;
  hostname?: string;
};

export type CacheManager = {
  invalidate: (filter?: CacheFilter) => number;
  clear: () => void;
  readonly size: number;
};

export type SSRServer = {
  /**
   * Binds the port. Resolves once it takes connections — in a fleet, once the first worker does — so what says "ready"
   * (a log line, a file a tool reads, a test's first request) says it after, never before. A port it could not take
   * ends the process, or goes to `onListenError`: the promise is then never resolved.
   */
  listen: (port: number, host?: string) => Promise<void>;
  close: () => Promise<void>;
  readonly cache: CacheManager | null;
  readonly plugins: PluginRegistry;
  /**
   * With `livePages` on, every page open on this server loads again — what a change the pages cannot be handed as
   * documents calls (the server's own code, its plugins' declarations). Nothing otherwise.
   */
  reloadPages: () => void;
  /**
   * With `livePages` on, every page open on this server showing its own space — or, with `draft`, that draft — swaps it
   * for `documents` where it stands, its state, scroll and focus kept; a page that cannot (one with elements the server
   * draws) loads again. What a project that authors its space in code calls once it serves the new documents
   * (`serveProject`), instead of restarting the server. How many pages were told; none without `livePages`.
   */
  updatePages: (documents: OfflineDataRaw, options?: { draft?: string }) => number;
  /**
   * The server halves of the plugins this server ships (`functions.plugins`), replaced while it runs: what a development
   * server does when a plugin's `functions/` change. `definition` is what `loadFunctions` loads; none takes it away.
   */
  readonly functions: { setPlugin: (plugin: string, definition: unknown) => void };
};
