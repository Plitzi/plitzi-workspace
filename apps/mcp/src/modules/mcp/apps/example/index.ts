import { shippedPath, VIEW_DIR } from '../shared';

import type { McpApp } from '../../types';

/** The reference app: the smallest definition that works, kept as the template a new app is copied from.
 *
 *  It is deliberately NOT in the `apps` list — nothing renders it, since no tool points at it — so it costs a
 *  real deployment nothing while the test suite still builds it, which is what keeps it from rotting. To turn it
 *  into a real app: add it to `apps` in ../index.ts and give a tool `ui: { resourceUri: EXAMPLE_APP_URI }`. */

export const EXAMPLE_APP_URI = 'ui://plitzi/example.html';

export const exampleApp: McpApp = {
  uri: EXAMPLE_APP_URI,
  name: 'plitzi-example-app',
  title: 'Example app',
  description: 'Reference MCP App: shows a tool result and calls a tool back. Not linked to any tool.',
  // Its view ships as source beside this module (the copy-assets step in vite.config.ts): this definition is compiled,
  // everything the browser entry bundles travels verbatim.
  entry: shippedPath(import.meta.url, `${VIEW_DIR}/index.tsx`, `modules/mcp/apps/example/${VIEW_DIR}/index.tsx`)
  // `styles` and `csp` are optional: a view with no stylesheet of its own inherits the host's look through
  // useHostStyles, and the default CSP already allows the images, fonts and fetches a view may need.
};
