import { afterEach, describe, expect, it, vi } from 'vitest';

import { requestJson } from './http';

const answering = (status: number, body: unknown) =>
  vi.stubGlobal('fetch', () => Promise.resolve(new Response(JSON.stringify(body), { status })));

afterEach(() => {
  vi.unstubAllGlobals();
});

// RFC 0029 §8: a cloud command on a plan that does not include it says the plan and the link, whatever command asked.
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

    expect(reply).toEqual({ ok: false, error: expect.stringContaining(upgradeUrl) as unknown });
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
    expect(await requestJson('https://api.plitzi.com/x')).toEqual({ ok: false, error: 'Not on this plan. https://p' });

    answering(404, { error: 'Not found' });
    expect(await requestJson('https://api.plitzi.com/x')).toEqual({
      ok: true,
      status: 404,
      data: { error: 'Not found' }
    });
  });
});
