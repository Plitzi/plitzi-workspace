/**
 * The clipboard's `writeText`, bound — or `undefined` where the browser offers none. Typed as always there, it is not:
 * a page not served over https has none (a phone opening a development server by its network address), nor has the
 * server. A copy button that called it straight threw on such a page.
 */
export const clipboardWriter = (): ((text: string) => Promise<void>) | undefined => {
  const clipboard: unknown = typeof navigator === 'undefined' ? undefined : Reflect.get(navigator, 'clipboard');
  const writeText: unknown =
    typeof clipboard === 'object' && clipboard !== null ? Reflect.get(clipboard, 'writeText') : undefined;
  if (typeof writeText !== 'function') {
    return undefined;
  }

  return async text => {
    await Reflect.apply(writeText, clipboard, [text]);
  };
};

/** Copies `text`: whether it reached the clipboard — not where there is none, nor when the browser refuses it. */
export const copyText = async (text: string): Promise<boolean> => {
  const write = clipboardWriter();
  if (!write) {
    return false;
  }

  try {
    await write(text);

    return true;
  } catch {
    return false;
  }
};

/** What a copy button says when it could not copy, for its `title`. */
export const NOT_COPIED_REASON =
  'This page cannot reach the clipboard: it is not served over https, or the browser refused.';
