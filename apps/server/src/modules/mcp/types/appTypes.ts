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
  /** Stylesheets to inline, by absolute path — lazy so a missing one only fails on read. */
  styles?: () => string[];
  csp?: McpUiResourceCsp;
}
