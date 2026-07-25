import type { SdkAssetUrls } from '../types';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp';

// The ui:// resource plitzi_render links to via _meta.ui.resourceUri. An MCP Apps host (Claude, Claude Desktop,
// ChatGPT, Goose…) fetches it and renders it in a sandboxed iframe, then pushes the tool result in.
export const RENDER_APP_URI = 'ui://plitzi/render.html';

// The MCP Apps resource mime type — the signal to the host that this HTML is an interactive app view.
const RENDER_APP_MIME = 'text/html;profile=mcp-app';

// CSP the host applies to the widget's sandboxed iframe. The iframe runs on the HOST's origin, so the SDK this
// view imports is a cross-origin load that only the host's CSP can authorize: the server's own origin therefore
// goes FIRST, as the one domain the view genuinely needs. The wildcard entries behind it stay for the external
// IMAGES/fonts a widget may reference (recipe photos, product shots) and an apiContainer's fetches, kept open so
// the tool stays zero-config; the sandbox origin isolation contains the risk. A host that refuses a wildcard list
// still finds the concrete origin. Two dialects — `ui.csp` (SEP-1865: Claude) and `openai/widgetCSP` (ChatGPT's
// legacy snake_case) — declared on BOTH the listing and the content item, since ChatGPT reads the CSP from the
// content item while others read the listing.
const renderAppMeta = (origin: string) => {
  const own = origin ? [origin] : [];
  const csp = { resourceDomains: [...own, '*', 'data:', 'blob:'], connectDomains: [...own, '*'] };

  return {
    ui: { csp },
    'openai/widgetCSP': {
      resource_domains: csp.resourceDomains,
      connect_domains: csp.connectDomains
    }
  };
};

// Empty for the relative same-origin fallback, which declares no origin of its own.
const originOf = (url: string): string => {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
};

// How long the SDK modules get to load before the placeholder is replaced by an explicit failure panel. A host
// whose sandbox CSP forbids external scripts (or a server not serving /sdk-assets) otherwise leaves the iframe
// stuck on 'Rendering…' with the reason visible only in the sandbox's console.
const LOAD_TIMEOUT_MS = 10000;

// Runs FIRST, as a classic inline script: the MCP Apps postMessage handshake must not wait for the SDK module
// graph to download, because the host withholds the tool result until the view has initialized. It buffers the
// result on window.__plitziWidget for the module below, which may still be loading when it arrives.
const HANDSHAKE = `
(() => {
  const send = msg => window.parent.postMessage(msg, '*');
  const state = { params: undefined, mount: undefined, ready: false };
  window.__plitziWidget = state;

  window.addEventListener('message', event => {
    const msg = event.data;
    if (!msg || msg.jsonrpc !== '2.0') {
      return;
    }

    // Reply to the initialize result: the host withholds tool data until it gets our 'initialized' notification.
    if (msg.id === 1 && 'result' in msg) {
      send({ jsonrpc: '2.0', method: 'ui/notifications/initialized', params: {} });

      return;
    }

    if (msg.method === 'ui/notifications/tool-result') {
      state.params = msg.params;
      if (state.mount) {
        state.mount(msg.params);
      }
    }
  });

  setTimeout(() => {
    if (state.ready) {
      return;
    }

    const root = document.getElementById('plitzi');
    root.textContent = '';
    const box = document.createElement('div');
    box.setAttribute('style', 'padding:16px;font:13px/1.5 system-ui,sans-serif;color:#b91c1c');
    box.textContent = 'Could not load the Plitzi SDK from ' + window.__plitziSdkUrl + '.';
    root.appendChild(box);
  }, ${LOAD_TIMEOUT_MS});

  // Start the handshake immediately — nothing external blocks it, so the iframe is 'ready' at once.
  send({
    jsonrpc: '2.0',
    id: 1,
    method: 'ui/initialize',
    params: {
      protocolVersion: '2025-06-18',
      appInfo: { name: 'Plitzi Widget', version: '1.0.0' },
      appCapabilities: { availableDisplayModes: ['inline'] }
    }
  });
})();
`;

// The mount step, as an inline MODULE: it imports the SDK through the import map in <head>, so both the SDK and
// its React vendor bundle are plain ESM served from this server — nothing is bundled or compiled here.
// `render(rootId, props, plugins, debug, isHydrating)` — isHydrating=false → client createRoot.
const MOUNT = `
import { render } from '@plitzi/plitzi-sdk';

const state = window.__plitziWidget;
const root = document.getElementById('plitzi');
let mounted = false;

// Replace the 'Rendering…' placeholder with an explicit failure panel — otherwise a tool that returns
// { rendered:false } (no offlineData) or an SDK render error would leave the iframe stuck forever.
const showError = (title, details) => {
  mounted = true;
  root.textContent = '';
  const box = document.createElement('div');
  box.setAttribute('style', 'padding:16px;font:13px/1.5 system-ui,sans-serif;color:#b91c1c');
  const h = document.createElement('strong');
  h.textContent = title;
  box.appendChild(h);
  if (details) {
    const pre = document.createElement('pre');
    pre.setAttribute('style', 'margin:8px 0 0;white-space:pre-wrap;color:#7f1d1d;font-size:12px');
    pre.textContent = details;
    box.appendChild(pre);
  }

  root.appendChild(box);
};

// The failed-render text is the tool's JSON summary ({ rendered:false, errors:[{path,message,hint}] }).
const errorText = params => {
  const item = Array.isArray(params && params.content) ? params.content.find(c => c.type === 'text') : undefined;
  if (!item) {
    return '';
  }

  try {
    const parsed = JSON.parse(item.text);
    if (Array.isArray(parsed.errors)) {
      return parsed.errors
        .map(e => '• ' + (e.path ? e.path + ': ' : '') + e.message + (e.hint ? ' — ' + e.hint : ''))
        .join('\\n');
    }

    return item.text;
  } catch {
    return item.text;
  }
};

const mount = params => {
  if (mounted) {
    return;
  }

  const offlineData = params && params.structuredContent && params.structuredContent.offlineData;
  if (!offlineData) {
    showError('Render failed', errorText(params) || 'The tool returned no widget data.');

    return;
  }

  mounted = true;
  try {
    render('plitzi', { offlineData, offlineMode: true, environment: 'main', renderMode: 'raw' }, {}, false, false);
  } catch (err) {
    showError('Widget failed to render', String((err && err.message) || err));
  }
};

state.ready = true;
state.mount = mount;

// The tool result can land before this module finishes loading; the handshake script buffered it.
if (state.params) {
  mount(state.params);
}
`;

// The import map is what replaces bundling: the SDK dist is already ESM whose only external specifiers are the
// react family, and the vendor bundle exports exactly those — so mapping every react* specifier to it (and the
// package's own self-imports to the one SDK copy) is all the resolution the browser needs.
const importMap = (assets: SdkAssetUrls): string =>
  JSON.stringify(
    {
      imports: {
        react: assets.vendor,
        'react-dom': assets.vendor,
        'react-dom/client': assets.vendor,
        'react/jsx-runtime': assets.vendor,
        'react/compiler-runtime': assets.vendor,
        '@plitzi/plitzi-sdk': assets.js
      }
    },
    null,
    2
  );

const shell = (assets: SdkAssetUrls): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Plitzi widget</title>
    <link rel="modulepreload" href="${assets.vendor}" crossorigin />
    <link rel="modulepreload" href="${assets.js}" crossorigin />
    <link rel="stylesheet" href="${assets.css}" />
    <script type="importmap">
${importMap(assets)}
    </script>
    <style>
      html,
      body {
        margin: 0;
      }
      #plitzi:empty::after {
        content: 'Rendering…';
        display: block;
        padding: 16px;
        font: 14px system-ui, sans-serif;
        color: #64748b;
      }
    </style>
  </head>
  <body>
    <div id="plitzi" class="plitzi-root-container"></div>
    <script>
      window.__plitziSdkUrl = ${JSON.stringify(assets.js)};
${HANDSHAKE}
    </script>
    <script type="module">
${MOUNT}
    </script>
  </body>
</html>`;

// Register the render-app resource. The SDK, its React vendor bundle and its stylesheet are served straight from
// the installed @plitzi/plitzi-sdk dist under /sdk-assets (mounted by default, see withSdkAssets), and the page
// resolves them through an import map — no build step, and the browser caches them across widget renders.
// Trade-off: those are cross-origin fetches from the host's sandbox, so a host whose widget CSP forbids external
// scripts cannot run this view (the load timeout then reports it instead of hanging on the placeholder).
export const registerRenderApp = (server: McpServer, assets: SdkAssetUrls): void => {
  const html = shell(assets);
  const meta = renderAppMeta(originOf(assets.js));

  server.registerResource(
    'plitzi-render-app',
    RENDER_APP_URI,
    {
      description: 'Interactive view that renders a plitzi_render widget with the Plitzi SDK.',
      mimeType: RENDER_APP_MIME,
      _meta: meta
    },
    () => ({
      contents: [{ uri: RENDER_APP_URI, mimeType: RENDER_APP_MIME, text: html, _meta: meta }]
    })
  );
};
