import { AppBridge } from '@modelcontextprotocol/ext-apps/app-bridge';
import { JSDOM } from 'jsdom';

import { HostBridgeTransport, parentStub } from './postMessageChannel';

import type { McpUiHostContext, McpUiToolResultNotification } from '@modelcontextprotocol/ext-apps';

export interface RenderingHost {
  bridge: AppBridge;
  window: JSDOM['window'];
  /** Deliver a tool result and let the App paint before assertions run. */
  showResult: (result: McpUiToolResultNotification['params']) => Promise<void>;
  text: () => string;
  close: () => void;
}

// An opaque origin has no localStorage, and the SDK needs it.
const DOM_URL = 'https://mcp-app.test/';

// APIs jsdom does not implement; without them the App never gets to run.
const installBrowserStubs = (window: JSDOM['window']): void => {
  Object.defineProperty(window, 'ResizeObserver', {
    configurable: true,
    value: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  });
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (media: string) => ({
      media,
      matches: false,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false
    })
  });
};

const settle = (window: JSDOM['window'], turns = 6): Promise<void> =>
  new Promise(resolve => {
    let left = turns;
    const tick = () => (left-- > 0 ? window.setTimeout(tick, 0) : resolve());
    tick();
  });

/** Load a ui:// page into a DOM and complete the MCP Apps handshake against it, through the official AppBridge.
 *  Resolves once the App is connected, so a test can push a tool result straight away. */
export const startRenderingHost = async (html: string, hostContext?: McpUiHostContext): Promise<RenderingHost> => {
  const parent = parentStub();
  const dom = new JSDOM(html, {
    url: DOM_URL,
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(window) {
      installBrowserStubs(window);
      Object.defineProperty(window, 'parent', { configurable: true, value: parent });
    }
  });

  const { window } = dom;
  const bridge = new AppBridge(null, { name: 'e2e-host', version: '1.0.0' }, { openLinks: {} }, { hostContext });
  await bridge.connect(new HostBridgeTransport(window, parent));
  await settle(window);

  return {
    bridge,
    window,
    showResult: async result => {
      await bridge.sendToolResult(result);
      await settle(window, 12);
    },
    text: () => window.document.getElementById('app')?.textContent ?? '',
    close: () => dom.window.close()
  };
};
