import { AppBridge } from '@modelcontextprotocol/ext-apps/app-bridge';
import { JSDOM } from 'jsdom';

import { HostBridgeTransport, parentStub } from './postMessageChannel';

import type { McpUiHostContext, McpUiToolResultNotification } from '@modelcontextprotocol/ext-apps';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';

export interface RenderingHostOptions {
  hostContext?: McpUiHostContext;
  /** The MCP client the App's own tool calls are forwarded to; without one the bridge answers nothing. */
  client?: Client;
  /** Storage shared with the other views of this host, which jsdom does not do on its own: each DOM gets a
   *  private one, while a real host serves every view from the same origin. */
  storage?: Storage;
}

export interface RenderingHost {
  bridge: AppBridge;
  window: JSDOM['window'];
  /** Push arguments the way a host does while the model is still writing the call: healed JSON, sent zero or more
   *  times, any field possibly missing. */
  streamInput: (args: Record<string, unknown>) => Promise<void>;
  /** The complete arguments, which the spec makes the host send once before any result. */
  completeInput: (args: Record<string, unknown>) => Promise<void>;
  /** Deliver a tool result and let the App paint before assertions run. */
  showResult: (result: McpUiToolResultNotification['params']) => Promise<void>;
  /** What the App reported back to the model with ui/update-model-context, in order. */
  contextUpdates: string[];
  /** Wait for work the App does after the result arrives — a server round trip does not settle in microtasks. */
  waitFor: (predicate: () => boolean, timeoutMs?: number) => Promise<void>;
  text: () => string;
  close: () => void;
}

/** Stands in for one host origin's localStorage, so two views can be given the same one (or deliberately not). */
export const memoryStorage = (): Storage => {
  const entries = new Map<string, string>();

  return {
    get length() {
      return entries.size;
    },
    key: index => [...entries.keys()][index] ?? null,
    getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value);
    },
    removeItem: key => {
      entries.delete(key);
    },
    clear: () => entries.clear()
  };
};

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
export const startRenderingHost = async (html: string, options: RenderingHostOptions = {}): Promise<RenderingHost> => {
  const { hostContext, client, storage } = options;
  const parent = parentStub();
  const dom = new JSDOM(html, {
    url: DOM_URL,
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(window) {
      installBrowserStubs(window);
      Object.defineProperty(window, 'parent', { configurable: true, value: parent });
      if (storage) {
        Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });
      }
    }
  });

  const { window } = dom;
  const contextUpdates: string[] = [];
  const bridge = new AppBridge(
    client ?? null,
    { name: 'e2e-host', version: '1.0.0' },
    { openLinks: {}, serverTools: {}, logging: {} },
    { hostContext }
  );
  bridge.onupdatemodelcontext = params => {
    contextUpdates.push(JSON.stringify(params.content));

    return Promise.resolve({});
  };
  await bridge.connect(new HostBridgeTransport(window, parent));
  await settle(window);

  const waitFor = async (predicate: () => boolean, timeoutMs = 20_000): Promise<void> => {
    const deadline = Date.now() + timeoutMs;
    while (!predicate()) {
      if (Date.now() > deadline) {
        throw new Error('The App never reached the expected state');
      }

      await settle(window, 4);
    }
  };

  return {
    bridge,
    window,
    contextUpdates,
    waitFor,
    streamInput: async args => {
      await bridge.sendToolInputPartial({ arguments: args });
      await settle(window, 6);
    },
    completeInput: async args => {
      await bridge.sendToolInput({ arguments: args });
      await settle(window, 6);
    },
    showResult: async result => {
      await bridge.sendToolResult(result);
      await settle(window, 12);
    },
    text: () => window.document.getElementById('app')?.textContent ?? '',
    close: () => dom.window.close()
  };
};
