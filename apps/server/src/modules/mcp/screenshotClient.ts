import { PREVIEW_TOKEN_PARAM } from './constants';

import type { ScreenshotClient, ScreenshotImage, ScreenshotInput, ScreenshotResult } from './types';

export type HttpScreenshotClientConfig = {
  /** Browser service that turns a URL into PNG(s): POST { url, viewports } → { images }. */
  serviceUrl: string;
  /** SSR base the browser navigates to; the page path and the one-shot `__pt` token are appended. */
  renderBaseUrl: string;
  /** Injectable fetch (tests / non-global runtimes). Defaults to the global fetch. */
  fetchImpl?: typeof fetch;
};

const composeUrl = (base: string, pagePath: string, token?: string): string => {
  const url = new URL(pagePath, base);
  if (token) {
    url.searchParams.set(PREVIEW_TOKEN_PARAM, token);
  }

  return url.toString();
};

/** Default `ScreenshotClient`: composes the navigable preview URL (renderBaseUrl + pagePath + `?__pt=token`) and
 *  POSTs it to the browser service. Any network/HTTP failure surfaces as `ok:false` so the tool can fall back to
 *  the HTML preview instead of hard-failing. */
export const createHttpScreenshotClient = ({
  serviceUrl,
  renderBaseUrl,
  fetchImpl = fetch
}: HttpScreenshotClientConfig): ScreenshotClient => ({
  async capture({ pagePath, token, viewports }: ScreenshotInput): Promise<ScreenshotResult> {
    const url = composeUrl(renderBaseUrl, pagePath, token);

    let res: Response;
    try {
      res = await fetchImpl(serviceUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url, viewports })
      });
    } catch (err) {
      return { ok: false, error: 'SCREENSHOT_UNREACHABLE', message: `Browser service unreachable: ${String(err)}` };
    }

    if (!res.ok) {
      return { ok: false, error: 'SCREENSHOT_FAILED', message: `Browser service returned ${res.status}.` };
    }

    const body = (await res.json()) as { images?: ScreenshotImage[] };
    if (!body.images || body.images.length === 0) {
      return { ok: false, error: 'SCREENSHOT_EMPTY', message: 'Browser service returned no images.' };
    }

    return { ok: true, images: body.images };
  }
});
