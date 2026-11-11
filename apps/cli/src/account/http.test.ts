import { afterEach, describe, expect, it, vi } from 'vitest';

import { CLIENT_HEADER, CURRENT_HEADER } from '@plitzi/sdk-shared/clients';

import { readBehind } from './behind';
import { requestJson } from './http';
import { CLI_VERSION } from '../scaffold/project';

const answering = (status: number, body: unknown) =>
  vi.stubGlobal('fetch', () => Promise.resolve(new Response(JSON.stringify(body), { status })));

afterEach(() => {
  vi.unstubAllGlobals();
});

// A cloud command on a plan that does not include it says the plan and the link, whatever command asked.
describe('requestJson', () => {
  it('says a plan refusal as the server words it, with the way to the plan', async () => {
    const upgradeUrl = 'https://app.plitzi.com/pricing?space=7&plan=site';
    answering(402, {
      error: `The CLI's cloud commands are included in the Site plan and above — this space is on Free. Upgrade: ${upgradeUrl}`,
      code: 'plan-required',
      capability: 'cliCloud',
      requires: 'Site',
      upgradeUrl
    });

    const reply = await requestJson('https://api.plitzi.com/spaces/7/import');

    expect(reply).toEqual({ ok: false, code: 'not-allowed', error: expect.stringContaining(upgradeUrl) as unknown });
    expect(!reply.ok && reply.error).toContain('included in the Site plan');
  });

  it('adds the link when the words leave it out, and leaves any other answer to its caller', async () => {
    answering(402, {
      error: 'Not on this plan.',
      code: 'plan-required',
      capability: 'x',
      requires: 'App',
      upgradeUrl: 'https://p'
    });
    expect(await requestJson('https://api.plitzi.com/x')).toEqual({
      ok: false,
      code: 'not-allowed',
      error: 'Not on this plan. https://p'
    });

    answering(404, { error: 'Not found' });
    expect(await requestJson('https://api.plitzi.com/x')).toEqual({
      ok: true,
      status: 404,
      data: { error: 'Not found' }
    });
  });
});

// The platform judges every CLI by the version it says: one too old is refused with the step, one behind told once.
describe('a CLI out of step with the platform', () => {
  it('says which CLI it is on every request', async () => {
    const sent = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(() =>
      Promise.resolve(new Response('{}', { status: 200 }))
    );
    vi.stubGlobal('fetch', sent);
    await requestJson('https://api.plitzi.com/x', { headers: { Accept: 'application/json' } });

    const headers = new Headers(sent.mock.calls[0]?.[1]?.headers);

    expect(headers.get(CLIENT_HEADER)).toBe(`cli/${CLI_VERSION}`);
    expect(headers.get('accept')).toBe('application/json');
  });

  it('is refused below the oldest the platform takes, with the step that upgrades it', async () => {
    answering(426, {
      error: 'This CLI is 0.1.0, and the platform (0.40.0) takes 0.39.0 and later: …',
      code: 'outdated'
    });

    expect(await requestJson('https://api.plitzi.com/x')).toEqual({
      ok: false,
      code: 'outdated',
      error: 'This CLI is 0.1.0, and the platform (0.40.0) takes 0.39.0 and later: …'
    });
  });

  it('is answered when behind, and told so once — kept for the next command and for doctor', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve(new Response('{"ok":1}', { status: 200, headers: { [CURRENT_HEADER]: '99.0.0' } }))
    );
    const said = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    expect(await requestJson('https://api.plitzi.com/x')).toMatchObject({ ok: true, data: { ok: 1 } });
    await requestJson('https://api.plitzi.com/x');

    const told = said.mock.calls.map(call => String(call[0])).filter(line => line.includes('Plitzi 99.0.0 is out'));

    expect(told).toHaveLength(1);
    expect(told[0]).toContain(`this CLI is ${CLI_VERSION}`);
    expect(await readBehind()).toEqual({ api: 'https://api.plitzi.com', current: '99.0.0', cli: CLI_VERSION });
    said.mockRestore();
  });
});
