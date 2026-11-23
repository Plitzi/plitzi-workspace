import { toInteractionCallback } from '@plitzi/sdk-shared/authoring';
import { clipboardWriter } from '@plitzi/sdk-shared/helpers';

import { shareSpec } from './shareSpec';

type ShareParams = { url?: string; title?: string; text?: string };

/** What a share came to: through the device's sheet, or the address copied where there is no sheet. */
export type ShareResult = { shared: boolean; copied: boolean };

/**
 * Shares an address through the device's own sheet — the apps, the contacts — and, where the browser has none, copies
 * it instead: `copied` says which, so a flow says "Link copied" only when it was. A sheet the visitor closed is not a
 * failure (`shared: false`); a page with neither a sheet nor a clipboard fails, and the flow's `onFailure` runs.
 */
const share = toInteractionCallback<ShareParams>(
  'share',
  shareSpec,
  async ({ url, title, text }): Promise<ShareResult> => {
    const address = url || window.location.href;
    const shared = { url: address, ...(title ? { title } : {}), ...(text ? { text } : {}) };
    if (
      typeof navigator.share === 'function' &&
      (typeof navigator.canShare !== 'function' || navigator.canShare(shared))
    ) {
      try {
        await navigator.share(shared);

        return { shared: true, copied: false };
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return { shared: false, copied: false };
        }

        throw error;
      }
    }

    const write = clipboardWriter();
    if (!write) {
      throw new Error('This page can neither share nor copy: the browser offers no sheet and no clipboard here');
    }

    await write(address);

    return { shared: false, copied: true };
  }
);

export default share;
