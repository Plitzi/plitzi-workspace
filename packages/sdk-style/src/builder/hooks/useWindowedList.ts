import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { UIEvent } from 'react';

/** Rows drawn past each edge of what is in view, so a quick scroll does not show an empty band first. */
const OVERSCAN = 8;

export type WindowedList = {
  /** On the element that scrolls. */
  ref: (element: HTMLElement | null) => void;
  onScroll: (e: UIEvent<HTMLElement>) => void;
  /** The rows to draw: from `start`, up to but not including `end`. */
  start: number;
  end: number;
  /** The room of the rows not drawn, above and below them. */
  before: number;
  after: number;
};

/**
 * A long list drawn by what is in view: each row's height is known, so the rows out of view are room, not elements.
 * The Style Manager listed every selector of a space — 1,900 on the website — and each check, pick or scroll redrew
 * them all.
 */
const useWindowedList = (heights: readonly number[]): WindowedList => {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [viewport, setViewport] = useState({ top: 0, height: 600 });
  const frame = useRef(0);

  const offsets = useMemo(() => {
    const tops = [0];
    for (const height of heights) {
      tops.push(tops[tops.length - 1] + height);
    }

    return tops;
  }, [heights]);

  useEffect(() => {
    if (!element) {
      return undefined;
    }

    // Unmeasured — a document that lays nothing out — it keeps the height it starts with.
    const measure = () => setViewport(current => ({ ...current, height: element.clientHeight || current.height }));
    measure();
    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const observer = new ResizeObserver(measure);
    observer.observe(element);

    return () => observer.disconnect();
  }, [element]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const onScroll = useCallback((e: UIEvent<HTMLElement>) => {
    const top = e.currentTarget.scrollTop;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => setViewport(current => ({ ...current, top })));
  }, []);

  const total = offsets[offsets.length - 1];
  // The first row whose foot is below the top, and the first whose head is below the bottom: what the view holds.
  const first = Math.max(offsets.findIndex(offset => offset > viewport.top) - 1, 0);
  const last = offsets.findIndex(offset => offset >= viewport.top + viewport.height);
  const start = Math.max(first - OVERSCAN, 0);
  const end = Math.min((last === -1 ? heights.length : last) + OVERSCAN, heights.length);

  return {
    ref: setElement,
    onScroll,
    start,
    end,
    before: offsets[start],
    after: total - offsets[end]
  };
};

export default useWindowedList;
