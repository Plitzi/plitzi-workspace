import { toInteractionCallback } from '@plitzi/sdk-shared/authoring/builder';
import { clipboardWriter } from '@plitzi/sdk-shared/helpers/clipboard';

import { copyToClipboardSpec } from './copyToClipboardSpec';

/**
 * Writes `text` to the visitor's clipboard. A browser with no clipboard — an insecure origin, a document without focus,
 * a permission refused — throws, and the step fails with what it said: the flow's `onFailure` is where to tell them.
 */
const copyToClipboard = toInteractionCallback<{ text: string }>(
  'copyToClipboard',
  copyToClipboardSpec,
  async ({ text }) => {
    const write = clipboardWriter();
    if (!write) {
      throw new Error('This page has no clipboard to write to: the browser offers none here (a page not on https?)');
    }

    await write(text);
  }
);

export default copyToClipboard;
