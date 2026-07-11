import type { PreviewClient, PreviewRequestBody, PreviewResult } from './types';

export type HttpPreviewClientConfig = {
  /** Absolute URL of the SSR `/preview` endpoint. */
  url: string;
  /** Shared secret sent as `x-preview-secret`; must match the SSR server's `preview.secret`. */
  secret?: string;
  /** Injectable fetch (tests / non-global runtimes). Defaults to the global fetch. */
  fetchImpl?: typeof fetch;
};

/** Default `PreviewClient`: POSTs the preview request to the SSR `/preview` endpoint over HTTP. Used when the
 *  MCP server is a separate process from the SSR renderer (the common case). A network/HTTP failure surfaces as
 *  an `ok:false` result rather than throwing, so the calling tool can degrade gracefully. */
export const createHttpPreviewClient = ({
  url,
  secret,
  fetchImpl = fetch
}: HttpPreviewClientConfig): PreviewClient => ({
  async render(body: PreviewRequestBody): Promise<PreviewResult> {
    let res: Response;
    try {
      res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(secret ? { 'x-preview-secret': secret } : {}) },
        body: JSON.stringify(body)
      });
    } catch (err) {
      return { ok: false, error: 'PREVIEW_UNREACHABLE', message: `Preview endpoint unreachable: ${String(err)}` };
    }

    // 422 carries a structured PreviewResult (validation/apply errors) — read it as such; other non-2xx do not.
    if (!res.ok && res.status !== 422) {
      return { ok: false, error: 'PREVIEW_REQUEST_FAILED', message: `Preview endpoint returned ${res.status}.` };
    }

    return (await res.json()) as PreviewResult;
  }
});
