import type { McpUiResourceCsp } from '@modelcontextprotocol/ext-apps';

// Shape of an MCP App. The bundling and registration logic lives under apps/; only the contract lives here.

/** A `ui://` page the host renders in a sandboxed iframe, linked from a tool through `_meta.ui.resourceUri`. */
export interface McpApp {
  uri: string;
  name: string;
  description: string;
  title: string;
  /** Absolute path to the view: the app's browser entry. */
  entry: string;
  /** CSS to inline in the page, in order. Lazy, and the app produces the text itself: what a view needs is not
   *  always a file as it sits on disk (the render app leaves the icon fonts out of its stylesheet). */
  styles?: () => string[];
  csp?: McpUiResourceCsp;
}

/** Deployment switches the page hands to the view. They travel in the HTML rather than the bundle so a server
 *  that serves both settings still builds the (expensive) browser bundle once. The view reads them off
 *  `window.__PLITZI_VIEW__`, and must treat every one as optional: an older page carries none. */
export interface McpViewSettings {
  /** May the view paint from tool arguments the host is still streaming? See `mcpAi.renderStreaming`. */
  streaming: boolean;
  /** Absolute resource endpoint of the server that served the page, when it serves one (see `mcpAi.proxy`). It
   *  shapes the PAGE rather than the view: its origin is what the resource CSP declares, so the URLs a render
   *  rewrote to it are allowed to load. The view needs nothing from it — every URL is rewritten server-side,
   *  where the signing secret is. */
  proxyEndpoint?: string;
}
