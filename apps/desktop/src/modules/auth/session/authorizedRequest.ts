import type { ApiResult } from '@pmodules/network';

export type AuthorizedRequestDeps<T> = {
  /** Sends the request with this credential. Called at most twice: once, and again after a renewal. */
  send: (token: string) => Promise<ApiResult<T>>;
  /** The credential to present, renewed first if it is about to expire. `undefined` means there is no session. */
  token: () => Promise<string | undefined>;
  /** Trades the refresh token for a new session. `undefined` means there is no way back without the browser. */
  renew: () => Promise<string | undefined>;
  /** Forgets the local session, so the window returns to the sign-in screen instead of retrying forever. */
  endSession: () => Promise<void>;
};

/** The answer when there is no session at all, shaped like the server's own so callers need no second branch. */
const NO_SESSION = { ok: false as const, status: 401, reason: 'missing' };

/**
 * One request, with the session it needs — and with the server's answer about that session believed.
 *
 * The window used to decide entirely from its own clock: a stored token was good until `expiresAt`, so a session the
 * server had stopped accepting — revoked from another device, ended by a signing key that changed, deleted with the
 * row — was still "valid" here. Every call then returned 401, every screen showed "could not load", and there was no
 * way out of it without deleting the app's storage: the window was signed in to a server that disagreed.
 *
 * A 401 from this API is never about permission — that is a 403 — so it says exactly one thing: this credential is
 * no good. Which makes it evidence, and the only evidence worth more than the clock. So it is spent, once:
 *
 * 1. renew, because the likeliest cause is a session that died earlier than this window thought,
 * 2. send it again, and
 * 3. if it is refused a second time, end the local session — there is nothing left to renew with, and a window that
 *    keeps a credential the server refuses is a window that shows an error for the rest of the day.
 *
 * Once, deliberately: a second renewal would be answering the same refusal with the same question. And the retry is
 * not a general one — a 500 or a timeout is left exactly as it came back, because those are about the request.
 */
export const authorizedRequest = async <T>({
  send,
  token,
  renew,
  endSession
}: AuthorizedRequestDeps<T>): Promise<ApiResult<T>> => {
  const held = await token();
  if (!held) {
    return NO_SESSION;
  }

  const answer = await send(held);
  if (answer.status !== 401) {
    return answer;
  }

  const renewed = await renew();
  if (!renewed) {
    await endSession();

    return answer;
  }

  const retried = await send(renewed);
  if (retried.status === 401) {
    await endSession();
  }

  return retried;
};

export default authorizedRequest;
