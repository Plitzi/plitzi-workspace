/** What a widget is loading. Both ride the same endpoint but are not the same thing: an asset is immutable and
 *  cached hard, data is an API answer that must never be served stale, and each accepts its own content types. */
export type ProxyKind = 'asset' | 'data';

/** How a widget reaches ANYTHING outside its sandbox — an image, a font, a video, an API.
 *
 *  An MCP App runs in an iframe on the HOST's origin under a CSP the host builds from the domains this server
 *  declares, and that declaration belongs to the `ui://` RESOURCE: it is read (and may be cached) before any
 *  widget exists, the spec types `csp` as `never` on the tool meta, and plitzi_render is stateless, so the origins
 *  an agent is about to author can never be listed there. The one origin that CAN be declared up front is this
 *  server's own, so every external URL a render authored is rewritten to point here and this server fetches the
 *  original — which also settles the redirects, hotlink rules and missing CORS headers a null-origin sandbox
 *  cannot. Nothing is stored: the URL carries its own signed grant, so any replica answers any request. */
export interface ResourceProxy {
  /** Absolute endpoint the browser fetches from, e.g. `https://mcp.plitzi.app/__proxy`. */
  endpoint: string;
  /** Signs the grant, so the endpoint serves what this server rewrote and not whatever a caller asks for. */
  secret: string;
  /** Fingerprint of the MCP credential the render was called with (see `connectionId`). It is signed into every
   *  URL, so the grants one connection minted are distinct from another's and a widget's URLs cannot be pooled. */
  identity: string;
  /** How long a minted URL stays valid, in seconds. A widget outlives the call that made it (it sits in the
   *  conversation), so this is days rather than minutes — but not forever, so a leaked URL stops working. */
  ttl: number;
  /** The tools allowed to rewrite through this endpoint (see {@link DEFAULT_PROXY_TOOLS}). Carried here because
   *  the decision is made once, where each tool's context is built. */
  tools: readonly string[];
}

/** The tools a proxy may be handed to. `plitzi_render` alone by default, and that default is a guard, not a
 *  convenience: a render is a THROWAWAY widget, so rewriting its URLs changes nothing that outlives the call —
 *  while plitzi_apply writes to the user's real space, where a rewritten URL would be PERSISTED and the space
 *  would come to depend on this server's endpoint for content it owns. Nothing else should be added here without
 *  that being the intention. */
export const DEFAULT_PROXY_TOOLS = ['plitzi_render'];

/** The endpoint's own side of the same feature: where it answers and what it will carry. */
export interface ResourceProxySettings {
  path: string;
  secret: string;
  maxBytes: number;
  ttl: number;
  /** Which tools rewrite their URLs through the endpoint (see {@link DEFAULT_PROXY_TOOLS}). */
  tools: readonly string[];
  /** Absolute base to build widget URLs from. Empty → the origin each request arrived on, which is right whenever
   *  the MCP server owns its sub-domain. */
  baseUrl?: string;
}
