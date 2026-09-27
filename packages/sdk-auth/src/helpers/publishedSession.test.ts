import { describe, expect, it } from 'vitest';

import { publishedSession } from './publishedSession';

const ada = { id: 1, username: 'ada' };

describe('publishedSession', () => {
  it('is the provider’s session once it has one', () => {
    expect(
      publishedSession({
        state: 'authenticated',
        provider: { user: ada, accessToken: 'live' },
        bootstrap: { user: { id: 2, username: 'grace' }, accessToken: 'old' }
      })
    ).toEqual({ user: ada, accessToken: 'live' });
  });

  /** The first commit, before the provider has run: what the server rendered with, then what storage holds. */
  it('falls back to what is already known while the provider has not settled', () => {
    expect(publishedSession({ state: 'init', bootstrap: { user: ada, accessToken: 'ssr' } })).toEqual({
      user: ada,
      accessToken: 'ssr'
    });
    expect(publishedSession({ state: 'initLoading', peeked: { user: ada, accessToken: 'stored' } })).toEqual({
      user: ada,
      accessToken: 'stored'
    });
  });

  /** Signed out: the user the page was rendered with is not signed in any more, and must not be published as if. */
  it('is nobody once the provider says guest, whatever the page was rendered with', () => {
    expect(
      publishedSession({
        state: 'guest',
        bootstrap: { user: ada, accessToken: 'ssr' },
        peeked: { user: ada, accessToken: 'stored' }
      })
    ).toEqual({});
  });
});
