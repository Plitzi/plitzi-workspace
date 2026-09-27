import { applySessionOutcome } from './routes';

import type { AuthApi } from './api';
import type { CredentialCarrier } from './credentials';
import type { Csrf } from './csrf';
import type { CookieSink, SessionCookies } from './session';

/**
 * A navigation of the whole tab — not a frame, not an image, not a script's fetch. The one kind of request another
 * site cannot make on a visitor's behalf without the visitor watching it happen, which is what lets a renewal (it
 * rotates the session) answer a `GET`.
 */
export const isDocumentNavigation = (headers: Record<string, string | string[] | undefined>): boolean =>
  headers['sec-fetch-mode'] === 'navigate' && headers['sec-fetch-dest'] === 'document';

export interface RenewalOptions {
  api: AuthApi;
  cookies: SessionCookies;
  /** Re-issued for the renewed session, as every flow that grants one does. */
  csrf?: Csrf;
}

/**
 * `GET <basePath>/refresh?redirect=<page>`: renews the session this browser's refresh cookie holds, and answers where
 * to send the browser next — always back to the page, whether or not the renewal worked.
 *
 * It is where a page server sends a browser whose access cookie has died while its refresh cookie lives on, because
 * this is the one path the refresh cookie is sent to. What it writes is what makes the page render right on the way
 * back: the new session, or — for a refresh token that can never work again — no session and no hint, so the page
 * renders a guest and does not send the browser here a second time.
 */
export const renewForNavigation = async (
  req: CredentialCarrier,
  res: CookieSink,
  { api, cookies, csrf }: RenewalOptions
): Promise<string> => {
  const outcome = await api.refresh(cookies.resolveRefreshToken(req), req);

  applySessionOutcome(req, res, outcome, cookies, csrf);

  return cookies.returnTarget(req, req.query?.redirect);
};
