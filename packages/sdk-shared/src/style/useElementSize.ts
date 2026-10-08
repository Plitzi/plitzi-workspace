import { useEffect, useState } from 'react';

import type { RefObject } from 'react';

export type ElementSize = { width: number; height: number };

/**
 * The size an element is drawn at — a plugin's own box, which a sidebar, a panel or a split screen makes narrower than
 * the window — kept up to date as it changes. What `useDisplayMode` cannot say: a tablet held upright is `mobile` by
 * the window's breakpoints, and a week of seven columns still fits the 744 px the plugin has.
 *
 * `undefined` until it is measured: on the server, and in the browser's first render, so the page the server sent and
 * the one that hydrates it are the same. Decide from a fallback until then — the breakpoint's guess:
 * `const days = (size?.width ?? (useDisplayMode() === 'mobile' ? 390 : 1024)) >= 640 ? 7 : 3`.
 */
const useElementSize = (ref: RefObject<HTMLElement | null>): ElementSize | undefined => {
  const [size, setSize] = useState<ElementSize | undefined>(undefined);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const measure = (width: number, height: number): void =>
      setSize(previous => (previous?.width === width && previous.height === height ? previous : { width, height }));
    const box = node.getBoundingClientRect();
    measure(box.width, box.height);
    // One element is observed, so each call carries its one entry — or none, read as no change.
    const observer = new ResizeObserver(entries => {
      entries.slice(-1).forEach(entry => measure(entry.contentRect.width, entry.contentRect.height));
    });
    observer.observe(node);

    return () => observer.disconnect();
  }, [ref]);

  return size;
};

export default useElementSize;
