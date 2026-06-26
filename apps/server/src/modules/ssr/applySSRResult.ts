import type { SSRRenderResult, SSRResponseHelpers } from '@plitzi/sdk-shared';

// Applies the result produced during the React SSR render onto the HTTP response. Returns true when the
// response is complete (a redirect was emitted) and the caller must stop without sending an HTML body.
export const applySSRResult = (res: SSRResponseHelpers, result: SSRRenderResult): boolean => {
  if (result.headers) {
    for (const [name, value] of Object.entries(result.headers)) {
      res.setHeader(name, value);
    }
  }

  if (result.redirect !== undefined) {
    res.setStatus(result.status ?? 302);
    res.setHeader('Location', result.redirect);
    res.send('');

    return true;
  }

  if (result.status !== undefined) {
    res.setStatus(result.status);
  }

  return false;
};
