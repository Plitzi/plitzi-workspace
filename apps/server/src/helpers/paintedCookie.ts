import { requestAuthority } from '@plitzi/sdk-kernel/http';
import { serverLog } from '@plitzi/sdk-kernel/log';
import { getKeyDecoded } from '@plitzi/sdk-shared/helpers';
import { paintedKeys, paintedStateCookieName, paintedStateFor, pickPainted } from '@plitzi/sdk-shared/state';

import type { SSRPaintedDefaults } from '../types/config';
import type { SSRRequest } from '@plitzi/sdk-kernel/types';
import type { Environment, Schema } from '@plitzi/sdk-shared';

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

type PaintedState = ReturnType<typeof requestPaintedState>;

/** One answer a request: the render and its server providers read the same, and the deployment is asked once. */
const resolved = new WeakMap<object, Promise<PaintedState>>();

/**
 * `requestPaintedState` with the deployment's defaults (`paintedDefaults`) for the keys the cookie holds none of — for
 * an account the request proved, never a guest: a guest's page is cached for every guest, and a default is an
 * account's. Another account's entry holds nothing for this one (`paintedStateFor`), so after a change of account the
 * defaults are this account's. A deployment that fails to answer is said in the log, and the page is drawn without.
 */
export const requestPaintedStateWithDefaults = (
  req: Pick<SSRRequest, 'headers' | 'hostname'>,
  settings: Pick<Schema['settings'], 'keepState' | 'paintedState' | 'browserState'> | undefined,
  scope: { spaceId: number; environment: Environment; account: number | string | undefined },
  defaults: SSRPaintedDefaults | undefined
): Promise<PaintedState> => {
  const known = resolved.get(req);
  if (known) {
    return known;
  }

  const { account } = scope;
  const painted = requestPaintedState(req, settings, account);
  const missing = [...painted.keys].filter(key => painted.state?.[key] === undefined);
  const answer =
    !defaults || account === undefined || missing.length === 0
      ? Promise.resolve(painted)
      : (async (): Promise<PaintedState> => {
          try {
            const given = await defaults({
              spaceId: scope.spaceId,
              environment: scope.environment,
              account,
              keys: missing
            });
            const added = pickPainted(given, new Set(missing));

            return Object.keys(added).length > 0
              ? { keys: painted.keys, state: { ...painted.state, ...added } }
              : painted;
          } catch (error) {
            serverLog.error('SSR', `paintedDefaults did not answer for ${missing.join(', ')}: drawn without`, error);

            return painted;
          }
        })();
  resolved.set(req, answer);

  return answer;
};
