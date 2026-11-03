import { getKeyDecoded } from '@plitzi/sdk-shared/helpers';
import { paintedKeys, paintedStateCookieName, paintedStateFor } from '@plitzi/sdk-shared/state';

import { requestAuthority } from '../core/requestParser';

import type { Schema, SSRRequest } from '@plitzi/sdk-shared';

/**
 * The name the painted state of a server-rendered page is kept under, for this request's host.
 *
 * The page this server sends carries no `webKey`, so the SDK keeps its state under the web id an empty key decodes to —
 * the same one its web storage key uses. One helper for both readers of the cookie, the render and the HTML cache key,
 * so they cannot come to disagree about which cookie the page was drawn from.
 */
export const ssrPaintedCookieName = (host: string | undefined): string =>
  paintedStateCookieName(getKeyDecoded('', true), host);

/**
 * The state a server-rendered page starts from on this request — the keys the space paints, as the visitor's cookie
 * holds them — and which keys those are. One answer for the render (the SDK's starting `runtime.state`) and the page's
 * server providers (`{{ state.workspace.id }}` in a `query`), so a provider asks with the value the page is drawn with.
 * Only with `keepState` on, and of an entry another account wrote than the one this request proved, only the browser's
 * keys (`browserState`).
 */
export const requestPaintedState = (
  req: Pick<SSRRequest, 'headers' | 'hostname'>,
  settings: Pick<Schema['settings'], 'keepState' | 'paintedState' | 'browserState'> | undefined,
  account: number | string | undefined
): { keys: ReadonlySet<string>; state: Record<string, unknown> | undefined } => {
  if (!settings?.keepState) {
    return { keys: new Set(), state: undefined };
  }

  return {
    keys: paintedKeys(settings),
    state: paintedStateFor(req.headers.cookie, ssrPaintedCookieName(requestAuthority(req)), settings, account)
  };
};
