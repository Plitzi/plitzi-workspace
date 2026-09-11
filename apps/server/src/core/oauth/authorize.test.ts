import { describe, expect, it, vi } from 'vitest';

import { handleAuthorizeStart, handleAuthorizeSubmit } from './authorize';
import { renderConsentPage } from './consentPage';

import type { OAuthParams } from './params';
import type { OAuthConfig, SSRRequest, SSRResponseHelpers } from '@plitzi/sdk-shared';

const CLIENT = { clientId: 'client-1', redirectUris: ['https://host.test/cb'] };

const backingStore = () => {
  const rows = new Map<string, string>([[`oauth:client:${CLIENT.clientId}`, JSON.stringify(CLIENT)]]);

  return {
    put: (key: string, value: string) => void rows.set(key, value),
    get: (key: string) => rows.get(key),
    drop: (key: string) => void rows.delete(key),
    rows
  };
};

const params: OAuthParams = {
  response_type: 'code',
  client_id: CLIENT.clientId,
  redirect_uri: 'https://host.test/cb',
  code_challenge: 'abc',
  code_challenge_method: 'S256',
  state: 'st-1',
  scope: 'agent'
};

const request = { headers: { host: 'mcp.plitzi.test' } } as unknown as SSRRequest;

const capture = () => {
  const sent = { body: '', status: 0, headers: {} as Record<string, string> };
  const res = {
    setStatus: vi.fn((value: number) => {
      sent.status = value;
    }),
    setHeader: vi.fn((name: string, value: string) => {
      sent.headers[name] = value;
    }),
    send: vi.fn((value: string) => {
      sent.body = value;
    }),
    end: vi.fn()
  } as unknown as SSRResponseHelpers;

  return { res, sent };
};

const setup = (signOut?: OAuthConfig['adapters']['signOut']) => {
  const store = backingStore();
  const config = {
    issuer: 'https://mcp.plitzi.test',
    signInUrl: 'https://auth.plitzi.test/login',
    adapters: {
      identify: () => Promise.resolve({ id: '7', label: 'ada@plitzi.test' }),
      grantTargets: () => Promise.resolve([{ value: 'space-1', label: 'Website' }]),
      issueToken: () => Promise.resolve({ token: 't' }),
      signOut,
      store
    }
  } as unknown as OAuthConfig;

  return { config, store };
};

const start = async (signOut?: OAuthConfig['adapters']['signOut']) => {
  const { config, store } = setup(signOut);
  const { res, sent } = capture();
  await handleAuthorizeStart(config, res, params, request);

  return { config, store, sent };
};

/**
 * The escape hatch for a browser signed in as somebody else.
 *
 * Whoever reaches this screen arrived from another application, so the only way out of the wrong account is one this
 * page offers: without it, the route back is to find the deployment's sign-out page in a second tab and start the
 * connection over from the host.
 */
describe('the grant screen / connecting as another account', () => {
  it('offers the way out when the deployment can act on it', async () => {
    const { sent } = await start(() => undefined);

    expect(sent.body).toContain('Use another account');
    expect(sent.body).toContain('name="switch"');
  });

  /** A button that pretends to do something is worse than no button: the deployment has to be able to end a session. */
  it('offers nothing when the deployment supplied no way to sign out', async () => {
    const { sent } = await start();

    expect(sent.body).not.toContain('Use another account');
  });

  /**
   * A submit, not a link. Ending a session may not hang off a URL anything can navigate to — an `<img src>` on any
   * page on the internet would then be able to sign a visitor out.
   */
  it('is a form submission rather than an address', async () => {
    const { sent } = await start(() => undefined);
    const button = /<button[^>]*name="switch"[^>]*>/u.exec(sent.body)?.[0] ?? '';

    expect(button).toContain('type="submit"');
    expect(sent.body).not.toMatch(/<a[^>]*switch/u);
  });
});

describe('the grant screen / posting "use another account"', () => {
  const submit = async () => {
    const { config, store } = setup(vi.fn());
    const { res, sent } = capture();
    // The pending record the grant screen minted, which the form carries back.
    void store.put('oauth:pending:p1', JSON.stringify({ clientId: CLIENT.clientId, user: { id: '7', label: 'ada' } }));
    await handleAuthorizeSubmit(config, res, { ...params, switch: '1', pending: 'p1' }, request);

    return { config, store, sent };
  };

  it('ends the session and starts the same request over', async () => {
    const { config, sent } = await submit();

    expect(config.adapters.signOut).toHaveBeenCalledOnce();
    expect(sent.status).toBe(302);

    const location = new URL(sent.headers['Location']);
    const back = new URL(location.searchParams.get('redirect') ?? '');

    expect(location.origin + location.pathname).toBe('https://auth.plitzi.test/login');
    expect(back.origin + back.pathname).toBe('https://mcp.plitzi.test/authorize');
    expect(back.searchParams.get('client_id')).toBe(CLIENT.clientId);
    expect(back.searchParams.get('code_challenge')).toBe('abc');
    expect(back.searchParams.get('state')).toBe('st-1');
    expect(back.searchParams.get('scope')).toBe('agent');
  });

  /** The identity it vouched for is the one being abandoned: left redeemable, it is a grant open to whoever is next. */
  it('drops the pending record it was carrying', async () => {
    const { store } = await submit();

    expect(store.rows.has('oauth:pending:p1')).toBe(false);
  });
});

describe('the grant screen / markup', () => {
  it('escapes what a deployment puts around the form', () => {
    const markup = renderConsentPage({
      action: '/authorize',
      hidden: { state: '"><script>alert(1)</script>' },
      targets: [{ value: 'a', label: 'A' }],
      user: { id: '1', label: 'ada' },
      canSwitchUser: true,
      branding: {}
    });

    expect(markup).not.toContain('<script>alert(1)</script>');
    expect(markup).toContain('&quot;&gt;&lt;script&gt;');
  });
});
