import type { AuthState } from '@plitzi/sdk-shared';

/**
 * Who the page says is signed in, from what is known about them at this moment.
 *
 * The provider is authoritative once it has settled. Before that — the first commit of a server-rendered page, a reload
 * with a session in storage — it holds nothing yet, and the page falls back to what it already knows: the user the
 * server rendered with (`bootstrap`), then the one peeked from storage (`peeked`).
 *
 * Only before. Once the provider says `guest` there is nobody, whatever the page was rendered with: the fallback used
 * to outlive a sign-out, so the page went on publishing the previous person and every flow that asked "is anybody
 * signed in?" was told yes — a sign-in screen that sends signed-in visitors to their account sent this one there, the
 * account (rightly) sent them back, and the two bounced off each other hundreds of times a second.
 */
export const publishedSession = <U>(input: {
  state: AuthState;
  provider?: { user?: U; accessToken?: string };
  bootstrap?: { user?: U; accessToken?: string };
  peeked?: { user?: U; accessToken?: string };
}): { user?: U; accessToken?: string } => {
  const { state, provider, bootstrap, peeked } = input;
  if (provider?.user) {
    return { user: provider.user, accessToken: provider.accessToken };
  }

  if (state === 'guest') {
    return {};
  }

  if (bootstrap?.user) {
    return { user: bootstrap.user, accessToken: bootstrap.accessToken };
  }

  return peeked?.user ? { user: peeked.user, accessToken: peeked.accessToken } : {};
};
