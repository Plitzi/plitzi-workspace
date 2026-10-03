import { createServer } from 'node:net';

import { afterEach, describe, expect, it } from 'vitest';

import { freePort } from './freePort';

import type { Server } from 'node:net';

const servers: Server[] = [];

const occupy = (port: number, host: string): Promise<void> =>
  new Promise(resolve => {
    const server = createServer();
    servers.push(server);
    server.listen(port, host, () => resolve());
  });

describe('freePort', () => {
  afterEach(async () => {
    await Promise.all(servers.splice(0).map(server => new Promise(resolve => server.close(resolve))));
  });

  it('is the preferred port when nothing uses it', async () => {
    expect(await freePort(39401)).toBe(39401);
  });

  it('steps past a port somebody else listens on, whatever address they took', async () => {
    await occupy(39411, '127.0.0.1');
    await occupy(39412, '0.0.0.0');

    expect(await freePort(39411)).toBe(39413);
  });

  it('says what to do when there is none', async () => {
    await occupy(39421, '127.0.0.1');

    await expect(freePort(39421, '127.0.0.1', 1)).rejects.toThrow(/No free port between 39421 and 39421[^]*Set PORT/);
  });
});
