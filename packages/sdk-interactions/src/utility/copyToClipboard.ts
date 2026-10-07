import { toInteractionCallback } from '@plitzi/sdk-shared/authoring/builder';

import { copyToClipboardSpec } from './copyToClipboardSpec';

/**
 * Writes `text` to the visitor's clipboard. A browser with no clipboard — an insecure origin, a document without focus,
 * a permission refused — throws, and the step fails with what it said: the flow's `onFailure` is where to tell them.
 */
const copyToClipboard = toInteractionCallback<{ text: string }>(
  'copyToClipboard',
  copyToClipboardSpec,
  async ({ text }) => {
    const clipboard: unknown = typeof navigator === 'undefined' ? undefined : Reflect.get(navigator, 'clipboard');
    const writeText: unknown =
      typeof clipboard === 'object' && clipboard !== null ? Reflect.get(clipboard, 'writeText') : undefined;
    if (typeof writeText !== 'function') {
      throw new Error('This page has no clipboard to write to: the browser offers none here (a page not on https?)');
    }

    await Reflect.apply(writeText, clipboard, [text]);
  }
);

export default copyToClipboard;
