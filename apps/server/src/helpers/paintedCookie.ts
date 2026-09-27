import { getKeyDecoded } from '@plitzi/sdk-shared/helpers/utils';
import { paintedStateCookieName } from '@plitzi/sdk-shared/state/paintedState';

/**
 * The name the painted state of a server-rendered page is kept under, for this request's host.
 *
 * The page this server sends carries no `webKey`, so the SDK keeps its state under the web id an empty key decodes to —
 * the same one its web storage key uses. One helper for both readers of the cookie, the render and the HTML cache key,
 * so they cannot come to disagree about which cookie the page was drawn from.
 */
export const ssrPaintedCookieName = (host: string | undefined): string =>
  paintedStateCookieName(getKeyDecoded('', true), host);
