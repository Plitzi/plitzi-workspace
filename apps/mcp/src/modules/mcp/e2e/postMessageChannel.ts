import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import type { JSDOM } from 'jsdom';

export interface ParentStub {
  postMessage: (message: unknown) => void;
  attach: (deliver: (message: unknown) => void) => void;
}

/** Stands in for the window an iframe posts to. It BUFFERS: the page starts parsing the moment the DOM is built,
 *  so without the queue its `ui/initialize` is dropped and the handshake silently never completes. */
export const parentStub = (): ParentStub => {
  const pending: unknown[] = [];
  let deliver: ((message: unknown) => void) | undefined;

  return {
    postMessage: message => (deliver ? deliver(message) : pending.push(message)),
    attach: next => {
      deliver = next;
      pending.splice(0).forEach(next);
    }
  };
};

/** The host end of that channel, as a transport an AppBridge can connect to. */
export class HostBridgeTransport implements Transport {
  onmessage?: (message: JSONRPCMessage) => void;
  onclose?: () => void;
  onerror?: (error: Error) => void;

  constructor(
    private readonly window: JSDOM['window'],
    private readonly parent: ParentStub
  ) {}

  start(): Promise<void> {
    this.parent.attach(message => this.onmessage?.(message as JSONRPCMessage));

    return Promise.resolve();
  }

  send(message: JSONRPCMessage): Promise<void> {
    // `source` is the identity the App's transport validates before accepting a frame.
    const event = new this.window.MessageEvent('message', {
      data: message,
      source: this.parent as unknown as Window
    });
    this.window.dispatchEvent(event);

    return Promise.resolve();
  }

  close(): Promise<void> {
    this.onclose?.();

    return Promise.resolve();
  }
}
