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
