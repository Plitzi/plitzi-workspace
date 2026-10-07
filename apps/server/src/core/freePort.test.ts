import { createServer } from 'node:net';

import { afterEach, describe, expect, it } from 'vitest';

import { freePort } from './freePort';
import { unusedPort } from './unusedPort';

import type { Server } from 'node:net';

const servers: Server[] = [];

const occupy = (port: number, host: string): Promise<boolean> =>
  new Promise(resolve => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.listen(port, host, () => {
      servers.push(server);
      resolve(true);
    });
  });

/** Two ports side by side, the first on one address and the second on every address — retried where the second is taken. */
const occupyPair = async (): Promise<number> => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const port = await unusedPort();
    if ((await occupy(port, '127.0.0.1')) && (await occupy(port + 1, '0.0.0.0'))) {
      return port;
    }

    await Promise.all(servers.splice(0).map(server => new Promise(resolve => server.close(resolve))));
  }

  throw new Error('No two free ports side by side');
};

describe('freePort', () => {
  afterEach(async () => {
    await Promise.all(servers.splice(0).map(server => new Promise(resolve => server.close(resolve))));
  });

  it('is the preferred port when nothing uses it', async () => {
    const port = await unusedPort();

    expect(await freePort(port)).toBe(port);
  });

  it('steps past a port somebody else listens on, whatever address they took', async () => {
    const port = await occupyPair();

    expect(await freePort(port)).toBeGreaterThan(port + 1);
  });

  it('says what to do when there is none', async () => {
    const port = await unusedPort();
    await occupy(port, '127.0.0.1');

    await expect(freePort(port, '127.0.0.1', 1)).rejects.toThrow(
      new RegExp(`No free port between ${String(port)} and ${String(port)}[^]*Set PORT`)
    );
  });
});
