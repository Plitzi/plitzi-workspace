import https from 'node:https';

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { reachOwnServer } from './inside';
import { TEST_CERTIFICATES } from '../testing/certificates';

/**
 * A self-hosted server serving TLS with a certificate Node does not trust, reached from its own process at its public
 * address. The fixtures are two self-signed certificates made for this test alone.
 */

const own = { key: TEST_CERTIFICATES.own.key, cert: TEST_CERTIFICATES.own.cert };
const other = { key: TEST_CERTIFICATES.other.key, cert: TEST_CERTIFICATES.other.cert };

let server: https.Server;
let port = 0;

beforeAll(async () => {
  server = https.createServer(own, (_req, res) => res.end('own'));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  port = typeof address === 'object' && address ? address.port : 0;
});

afterEach(async () => {
  const { Agent, setGlobalDispatcher } = await import('undici');
  setGlobalDispatcher(new Agent());
});

afterAll(async () => {
  await new Promise(resolve => server.close(resolve));
});

describe('reachOwnServer', () => {
  it('reaches its own address on this machine, taking its own certificate', async () => {
    const publicUrl = `https://192.0.2.10:${String(port)}`;
    await reachOwnServer({ publicUrl, listener: { host: '127.0.0.1', port }, cert: own.cert });

    const response = await fetch(`${publicUrl}/mcp`);

    expect(await response.text()).toBe('own');
  });

  it('refuses a listener presenting any other certificate', async () => {
    const publicUrl = `https://192.0.2.10:${String(port)}`;
    await reachOwnServer({ publicUrl, listener: { host: '127.0.0.1', port }, cert: other.cert });

    await expect(fetch(`${publicUrl}/mcp`)).rejects.toThrow();
  });
});
