import { describe, expect, it, vi } from 'vitest';

import { getClient } from './records';
import { handleRegister } from './register';

import type { OAuthConfig, SSRResponseHelpers } from '@plitzi/sdk-shared';

/** What a client calls itself is shown to the person it acts for, so it is kept — and kept to a line. */

const setup = () => {
  const rows = new Map<string, string>();
  const config = {
    issuer: 'https://api.plitzi.test',
    adapters: {
      store: {
        put: (key: string, value: string) => void rows.set(key, value),
        get: (key: string) => rows.get(key),
        drop: (key: string) => void rows.delete(key)
      }
    }
  } as unknown as OAuthConfig;
  let body = '';
  const res = {
    setStatus: vi.fn(),
    setHeader: vi.fn(),
    send: vi.fn((value: string) => {
      body = value;
    })
  } as unknown as SSRResponseHelpers;

  return { config, res, answer: () => JSON.parse(body) as Record<string, unknown> };
};

describe('registering a client', () => {
  it('keeps the name it gave and the software it says it is', async () => {
    const { config, res, answer } = setup();

    await handleRegister(config, res, {
      client_name: 'Plitzi CLI on carlos-mbp',
      software_id: 'plitzi-cli',
      redirect_uris: ['http://127.0.0.1:5000/callback']
    });

    const clientId = String(answer().client_id);
    expect(answer()).toMatchObject({ client_name: 'Plitzi CLI on carlos-mbp', software_id: 'plitzi-cli' });
    expect(await getClient(config.adapters.store, clientId)).toMatchObject({
      clientName: 'Plitzi CLI on carlos-mbp',
      softwareId: 'plitzi-cli'
    });
  });

  it('keeps a name to a line, and an empty one is no name', async () => {
    const { config, res, answer } = setup();

    await handleRegister(config, res, {
      client_name: `  ${'x'.repeat(500)}  `,
      software_id: '   ',
      redirect_uris: ['http://127.0.0.1:5000/callback']
    });

    const client = await getClient(config.adapters.store, String(answer().client_id));
    expect(client?.clientName).toHaveLength(120);
    expect(client?.softwareId).toBeUndefined();
  });

  /** The native deployment grants a whole session, and its apps only ever listen on this computer. */
  it('takes only loopback redirects when the deployment says so', async () => {
    const { config, res, answer } = setup();
    const native = { ...config, loopbackRedirectsOnly: true };

    await handleRegister(native, res, { client_name: 'Plitzi Desktop', redirect_uris: ['https://evil.test/cb'] });
    expect(res.setStatus).toHaveBeenLastCalledWith(400);

    await handleRegister(native, res, { client_name: 'Plitzi CLI', redirect_uris: ['http://127.0.0.1:5000/callback'] });
    expect(answer()).toMatchObject({ redirect_uris: ['http://127.0.0.1:5000/callback'] });
  });
});
