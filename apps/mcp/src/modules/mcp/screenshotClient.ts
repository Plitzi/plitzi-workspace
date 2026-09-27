import { PREVIEW_TOKEN_PARAM } from '@plitzi/sdk-server/kernel';

import { outlineOfTree } from './accessibilityOutline';

import type { AccessibilityNode } from './accessibilityOutline';
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

/**
 * The service's answer when the PAGE failed rather than the browser: `502 { error: 'RENDER_FAILED', status }`.
 *
 * Told apart because the two call for different things. A browser that failed may do better in a minute; a page that
 * answered 404 will answer it again, and a caller that keeps images must never keep a picture of one.
 */
const readRefusal = async (res: Response): Promise<{ status: number } | undefined> => {
  if (res.status !== 502) {
    return undefined;
  }

  try {
    const body = (await res.json()) as { error?: unknown; status?: unknown };

    return body.error === 'RENDER_FAILED' && typeof body.status === 'number' ? { status: body.status } : undefined;
  } catch {
    return undefined;
  }
};

/** Default `ScreenshotClient`: composes the navigable preview URL (renderBaseUrl + pagePath + `?__pt=token`) and
 *  POSTs it to the browser service. Any network/HTTP failure surfaces as `ok:false` so the tool can fall back to
 *  the HTML preview instead of hard-failing. */
export const createHttpScreenshotClient = ({
  serviceUrl,
  renderBaseUrl,
  fetchImpl = fetch
}: HttpScreenshotClientConfig): ScreenshotClient => ({
  async capture({
    pagePath,
    token,
    viewports,
    fullPage,
    colorScheme,
    views = ['image']
  }: ScreenshotInput): Promise<ScreenshotResult> {
    const url = composeUrl(renderBaseUrl, pagePath, token);

    let res: Response;
    try {
      res = await fetchImpl(serviceUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url, viewports, fullPage, colorScheme, views })
      });
    } catch (err) {
      return { ok: false, error: 'SCREENSHOT_UNREACHABLE', message: `Browser service unreachable: ${String(err)}` };
    }

    if (!res.ok) {
      const refusal = await readRefusal(res);
      if (refusal) {
        return { ok: false, error: 'RENDER_FAILED', message: `The page answered ${refusal.status}.` };
      }

      return { ok: false, error: 'SCREENSHOT_FAILED', message: `Browser service returned ${res.status}.` };
    }

    const body = (await res.json()) as {
      images?: ScreenshotImage[];
      accessibility?: { label: string; tree: AccessibilityNode | null }[];
    };
    const images = body.images ?? [];
    if (views.includes('image') && images.length === 0) {
      return { ok: false, error: 'SCREENSHOT_EMPTY', message: 'Browser service returned no images.' };
    }

    // A service from before the accessibility view answers without it; the tool says so rather than failing.
    const accessibility = body.accessibility?.map(({ label, tree }) => ({ label, outline: outlineOfTree(tree) }));

    return { ok: true, images, ...(accessibility ? { accessibility } : {}) };
  }
});
