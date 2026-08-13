import type { OAuthConfig } from '@plitzi/sdk-shared';

/** How a rendered widget reaches ANYTHING outside its sandbox — images, media, fonts, and the endpoints an
 *  apiContainer fetches. A widget runs in an iframe under a CSP the host builds from the origins this server
 *  declares on its `ui://` resource, which is read before any widget exists (and the spec allows no per-call CSP),
 *  so the origins an agent is about to author can never be declared. With a `secret` set, every external URL a
 *  render authored is rewritten to this server's own endpoint — which IS declared — and fetched here, which also
 *  settles the redirects, hotlink rules and missing CORS headers a null-origin sandbox cannot. The agent never
 *  sees this: it authors the real URL. Without a secret there is no endpoint and the URLs travel as authored,
 *  loading only where the host allows their origin. */
export type McpProxyOptions = {
  /** Set false to serve no endpoint even with a secret configured. */
  enabled?: boolean;
  /** Where the endpoint answers. Default `/__proxy`. */
  path?: string;
  /** Signs each grant (target + kind + expiry + the connection that minted it), so the endpoint is not an open
   *  proxy. Required to enable it; any value stable across replicas works. */
  secret?: string;
  /** Absolute base for the URLs handed to widgets (`https://mcp.example.com`). Default: the origin each MCP
   *  request arrived on — right whenever the MCP server owns its sub-domain. */
  baseUrl?: string;
  /** Largest response the endpoint will pass through, in bytes. Default 8 MiB. */
  maxBytes?: number;
  /** How long a minted URL keeps working, in seconds. Default 7 days: a widget outlives the call that made it
   *  (it stays in the conversation), but a leaked URL should not work forever. */
  ttl?: number;
  /** Which MCP tools may be handed the endpoint at all. Defaults to `['plitzi_render']`, and that default is a
   *  guard rather than a convenience: a render is a throwaway widget, so a rewritten URL lives exactly as long as
   *  it does, while a tool that WRITES a space (plitzi_apply) would persist proxied URLs into content the user
   *  owns — their space would then depend on this server to show its own images, and those URLs expire. Listing a
   *  tool only makes the endpoint reachable from it; rewriting is something the tool has to implement, and today
   *  plitzi_render is the only one that does. */
  tools?: string[];
};

/**
 * Everything this package needs to serve MCP, and nothing the server it runs in has to know about.
 *
 * It is a SECOND argument — to `createServer` here, and to `mcpExtensions` for a page server — rather than a
 * section of `SSRServerConfig`, because that config belongs to the HTTP/page server: a deployment that serves
 * pages and never installs this package should not be reading about widget proxies and OAuth in the type it
 * configures its renderer with. The stages close over what they were given instead of digging it back out of
 * `ctx.config`, which is also what keeps them mountable in a server whose config this package has never seen.
 */
export type McpOptions = {
  /** Where MCP answers inside a server that also serves pages. Default `/mcp`; a dedicated MCP server owns its
   *  whole origin and ignores it. There is no `enabled` flag: handing the stages over IS the decision. */
  path?: string;
  /** Whether the plitzi_render view may paint from the tool arguments while the host is still STREAMING them: a
   *  placeholder that grows with the widget being authored, instead of the static "Rendering…" held for as long as
   *  the model takes to write the batch. Defaults to true; hosts that stream nothing are unaffected either way.
   *  Set false to keep every view blank until the finished widget arrives. */
  renderStreaming?: boolean;
  /** See {@link McpProxyOptions}. */
  proxy?: McpProxyOptions;
  /** For an MCP server that runs separately from the renderer (the CLIENT side): where to reach the SSR
   *  `/preview` endpoint so the visual-preview tools work. The SDK builds an HTTP preview client from this;
   *  absent → those tools report PREVIEW_UNAVAILABLE. */
  previewClient?: { url: string; secret?: string };
  /** Dedicated headless-browser service for plitzi_screenshot (off unless set). `serviceUrl` is the browser
   *  service that turns a URL into PNG(s); `renderBaseUrl` is the SSR base the browser navigates to (a page path
   *  + the one-shot `__pt` token are appended). When absent, plitzi_screenshot is not registered and only the HTML
   *  plitzi_preview is available; when the service is unreachable at call time the tool degrades to returning the
   *  HTML preview with a warning. */
  screenshot?: { serviceUrl: string; renderBaseUrl: string };
  /** OAuth 2.1 authorization for remote connectors (Claude Desktop, ChatGPT), which cannot send a custom header.
   *  Omit to keep the server anonymous: discovery 404s and every caller is served unauthenticated. */
  oauth?: OAuthConfig;
};
