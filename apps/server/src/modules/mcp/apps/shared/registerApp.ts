import { registerAppResource, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';

import { page } from './page';

import type { McpApp, McpViewSettings } from '../../types';
import type { McpUiResourceCsp, McpUiResourceMeta } from '@modelcontextprotocol/ext-apps';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// The page itself fetches nothing; this covers what a rendered WIDGET reaches at runtime — the images, media and
// fonts an agent authored, and the endpoints an apiContainer reads.
//
// It has to be this wide, and it cannot be narrowed to the origins a widget actually uses. The CSP belongs to the
// `ui://` RESOURCE (hosts read it from resources/read, with the resources/list entry as fallback, and MAY cache
// it), while the widget's origins are authored per tool call, afterwards — and plitzi_render is stateless, so the
// read that carries this metadata has no idea which widget it is about. There is no per-result CSP: the spec types
// `csp` as `never` on the tool meta and hosts ignore it there.
//
// So `proxyEndpoint`'s origin is the one that carries the feature: this server's own, a plain https origin every
// host accepts, and every external URL a render authored is rewritten to it — a widget's images, fonts and API
// calls therefore come from a declared origin whatever the agent wrote. The wildcards behind it only widen the
// net for what no server can rewrite (a URL a widget builds at runtime out of fetched data), and they are spelled
// three ways because hosts disagree on which they validate: `*` is the wildcard source, `https:` the
// scheme-source, `https://*` a host-source with a wildcard host. A host that rejects a form drops it, keeps the
// rest, and MUST NOT allow anything it was not told about.
const defaultCsp = (proxyOrigin?: string): McpUiResourceCsp => ({
  resourceDomains: [...(proxyOrigin ? [proxyOrigin] : []), '*', 'https:', 'https://*', 'data:', 'blob:'],
  connectDomains: [...(proxyOrigin ? [proxyOrigin] : []), '*', 'https:', 'https://*']
});

const originOf = (endpoint?: string): string | undefined => {
  if (!endpoint) {
    return undefined;
  }

  try {
    return new URL(endpoint).origin;
  } catch {
    return undefined;
  }
};

/** Serves the app as a self-contained page: no import map, no asset mounts, no cross-origin fetches, so the
 *  strictest host sandbox runs it and no deployment has to serve anything extra. */
export const registerApp = (server: McpServer, app: McpApp, settings: McpViewSettings): void => {
  const meta: { ui: McpUiResourceMeta } = { ui: { csp: app.csp ?? defaultCsp(originOf(settings.proxyEndpoint)) } };

  registerAppResource(server, app.name, app.uri, { description: app.description, _meta: meta }, async () => ({
    contents: [{ uri: app.uri, mimeType: RESOURCE_MIME_TYPE, text: await page(app, settings), _meta: meta }]
  }));
};
