import type { BaseContext, Stage } from '@plitzi/sdk-kernel/http';

/** What a page's action calls send beside their cookies: the body's type. */
const ALLOWED_HEADERS = 'Content-Type';
const ALLOWED_METHODS = 'GET, POST, DELETE';

/**
 * CORS for the pages that call the actions on another origin (`action.pageOrigins`): their calls carry the visitor's
 * cookies (`credentials: 'include'`), so each is answered with its own origin and credentials — never `*`, which a
 * browser refuses with credentials and which would let any site call with a visitor's cookies. A preflight from one of
 * them is answered here; from any other origin it is not, and the browser stops the call. A request of no listed origin
 * goes on unmarked: the cross-site check after this refuses its write.
 */
export const createActionCorsStage = (pageOrigins: readonly string[]): Stage<BaseContext> => {
  const allowed = new Set(pageOrigins);

  return ({ req, res }) => {
    const origin = req.headers.origin;
    if (typeof origin !== 'string' || !allowed.has(origin)) {
      return false;
    }

    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
    if (req.method !== 'OPTIONS') {
      return false;
    }

    res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS);
    res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS);
    res.setHeader('Access-Control-Max-Age', '600');
    res.setStatus(204);
    res.end();

    return true;
  };
};
