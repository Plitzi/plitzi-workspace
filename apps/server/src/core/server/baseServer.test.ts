import net from 'node:net';

import { describe, expect, it, vi } from 'vitest';

import { createHttpServer } from './baseServer';

import type { Handler } from '../transports';
import type { PluginRegistry, SSRServerConfig } from '@plitzi/sdk-shared';

const noPlugins: PluginRegistry = {
  register: () => undefined,
  invalidate: () => Promise.resolve()
};

const handler = (() => undefined) as unknown as Handler;

const build = (config: SSRServerConfig = { httpVersion: 1 } as SSRServerConfig, onDestroy?: () => void) =>
  createHttpServer(config, () => handler, { label: 'TEST', cache: null, plugins: noPlugins, onDestroy });

/** Whether anything is accepting connections on the port. listen() is fire-and-forget, so a test that closes
 *  right after it would never prove the port was bound in the first place. */
const isBound = (port: number): Promise<boolean> =>
  new Promise(resolve => {
    const socket = net.connect({ port, host: '127.0.0.1' });
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
  });

describe('createHttpServer lifecycle', () => {
  /** A server can be built and discarded without ever taking a port — a consumer that wires one and then bails
   *  on a config error, or a test that only needs the registry. Closing it must release what it owns rather
   *  than throwing on the socket it never opened. */
  it('closes cleanly when it never listened', async () => {
    const onDestroy = vi.fn();
    const server = build(undefined, onDestroy);

    await expect(server.close()).resolves.toBeUndefined();
    expect(onDestroy).toHaveBeenCalledOnce();
  });

  it('closes a listening server and releases the port', async () => {
    const server = build();
    server.listen(39301, '127.0.0.1');
    await vi.waitFor(async () => expect(await isBound(39301)).toBe(true));

    await expect(server.close()).resolves.toBeUndefined();

    // The port going free is the only proof the transport actually closed.
    await vi.waitFor(async () => expect(await isBound(39301)).toBe(false));
  });

  /** A shutdown signal can land before the bind completes, and a teardown path must not blow up on that —
   *  ERR_SERVER_NOT_RUNNING is the state close() is aiming for, not a failure. Same for closing twice. */
  it('closes without waiting for the bind, and again after that', async () => {
    const server = build();
    server.listen(39302, '127.0.0.1');

    await expect(server.close()).resolves.toBeUndefined();
    await expect(server.close()).resolves.toBeUndefined();
    expect(await isBound(39302)).toBe(false);
  });

  it('refuses HTTP/3 without TLS, naming the server', () => {
    expect(() => build({ httpVersion: 3 } as SSRServerConfig)).toThrow(/\[TEST\].*httpVersion: 3.*tls/u);
  });

  /**
   * A port already taken is the first thing a new deployment hits, and it used to arrive as an unhandled `error`
   * event: a stack through node:net naming neither the port nor the server. The handler is what makes it reportable
   * at all — without one there is nothing to hand to `onListenError` either.
   */
  it('reports a port it cannot take, naming the server and the port', async () => {
    const holder = build();
    holder.listen(39303, '127.0.0.1');
    await vi.waitFor(async () => expect(await isBound(39303)).toBe(true));

    const onListenError = vi.fn();
    const blocked = build({ httpVersion: 1, onListenError } as unknown as SSRServerConfig);
    blocked.listen(39303, '127.0.0.1');

    await vi.waitFor(() => expect(onListenError).toHaveBeenCalled());
    const [error, context] = onListenError.mock.calls[0] as [NodeJS.ErrnoException, { port: number; label: string }];
    expect(error.code).toBe('EADDRINUSE');
    expect(context).toMatchObject({ port: 39303, host: '127.0.0.1', label: 'TEST' });

    await blocked.close();
    await holder.close();
  });
});
