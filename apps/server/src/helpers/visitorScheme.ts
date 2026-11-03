import { requestScheme } from '@plitzi/sdk-shared/theme/cookie';

import type { ColorScheme } from '@plitzi/sdk-shared';

/** The client hint a page asks Chromium for (`Accept-CH`), and that the document therefore varies by. */
export const SCHEME_HINT_HEADER = 'Sec-CH-Prefers-Color-Scheme';

/** The scheme the visitor's machine asks for, as this request says it: the client hint, else the SDK's cookie. */
export const visitorScheme = (req: {
  headers: { cookie?: string; 'sec-ch-prefers-color-scheme'?: string | string[] };
}): ColorScheme | undefined => {
  const hint = req.headers['sec-ch-prefers-color-scheme'];

  return requestScheme(req.headers.cookie, typeof hint === 'string' ? hint : undefined);
};
