import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp';

// The ui:// resource plitzi_render links to via _meta.ui.resourceUri. An MCP Apps host (Claude, Claude Desktop,
// Copilot, Goose…) fetches it and renders it in a sandboxed iframe, then pushes the tool result in.
export const RENDER_APP_URI = 'ui://plitzi/render.html';

// The MCP Apps resource mime type — the signal to the host that this HTML is an interactive app view.
const RENDER_APP_MIME = 'text/html;profile=mcp-app';

const originOf = (url: string): string => {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
};

// The iframe shell — a CLIENT-side render (no server SSR, no server CPU). It speaks the MCP Apps postMessage
// protocol INLINE (window.parent, per spec) so the iframe reports "ready" instantly with nothing external to load —
// no CDN, no bundler. It boots the real Plitzi SDK the same way ssr/views/template.ejs does (import map for React +
// @plitzi/plitzi-sdk served under /sdk-assets, the SDK css), and imports the SDK LAZILY only when the tool result
// arrives, so the large bundle never blocks the handshake. `render(rootId, props, plugins, debug, isHydrating)` —
// isHydrating=false → client createRoot. The SDK is served by this MCP server, so `sdkBase` is its absolute origin;
// the resource declares it under _meta.ui.csp (resource + connect) so the sandbox may load it cross-origin.
const appHtml = (sdkBase: string, devMode: boolean): string => {
  const js = `${sdkBase}/sdk-assets/plitzi-sdk.js`;
  // The SDK externalizes React into a separate vendor bundle whose filename differs by build mode, mirroring the
  // SSR asset resolution (prepareRender). The importmap below must point at the bundle that was actually built.
  const vendor = `${sdkBase}/sdk-assets/${devMode ? 'plitzi-sdk-dev-vendor.js' : 'plitzi-sdk-vendor.js'}`;
  const css = `${sdkBase}/sdk-assets/plitzi-sdk.css`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Plitzi widget</title>
    <link rel="modulepreload" href="${vendor}" crossorigin />
    <script type="importmap">
      {
        "imports": {
          "react": "${vendor}",
          "react-dom": "${vendor}",
          "react-dom/client": "${vendor}",
          "react/jsx-runtime": "${vendor}",
          "react/compiler-runtime": "${vendor}",
          "@plitzi/plitzi-sdk": "${js}"
        }
      }
    </script>
    <link href="${css}" rel="stylesheet" />
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
    <script type="module">
      const send = msg => window.parent.postMessage(msg, '*');
      const root = document.getElementById('plitzi');
      let mounted = false;

      // Replace the 'Rendering…' placeholder with an explicit failure panel — otherwise a tool that returns
      // { rendered:false } (no offlineData) or an SDK that fails to load would leave the iframe stuck forever.
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

      const mount = async params => {
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
          const { render } = await import('@plitzi/plitzi-sdk');
          render('plitzi', { offlineData, offlineMode: true, environment: 'main', renderMode: 'raw' }, {}, false, false);
        } catch (err) {
          showError('SDK failed to load', String((err && err.message) || err));
        }
      };

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
          void mount(msg.params);
        }
      });

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
    </script>
  </body>
</html>`;
};

// Register the render-app resource. `sdkBase` is this server's absolute origin (it serves the SDK bundle under
// /sdk-assets); without it the iframe cannot load the SDK, so the app is skipped and plitzi_render still returns its
// text summary + offlineData for hosts that consume it directly.
export const registerRenderApp = (server: McpServer, sdkBase: string, devMode: boolean): void => {
  const html = appHtml(sdkBase, devMode);
  const origin = originOf(sdkBase);

  server.registerResource(
    'plitzi-render-app',
    RENDER_APP_URI,
    {
      description: 'Interactive view that renders a plitzi_render widget with the Plitzi SDK (client-side).',
      mimeType: RENDER_APP_MIME,
      _meta: { ui: { csp: { resourceDomains: [origin], connectDomains: [origin] } } }
    },
    () => ({ contents: [{ uri: RENDER_APP_URI, mimeType: RENDER_APP_MIME, text: html }] })
  );
};
