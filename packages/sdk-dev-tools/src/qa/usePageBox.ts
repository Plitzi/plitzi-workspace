import { useEffect, useState } from 'react';

import type { RefObject } from 'react';

export interface PageBox {
  left: number;
  width: number;
  viewportWidth: number;
  viewportHeight: number;
}

const measure = (page: HTMLElement | null): PageBox => {
  const viewportWidth = typeof window === 'undefined' ? 0 : window.innerWidth;
  const viewportHeight = typeof window === 'undefined' ? 0 : window.innerHeight;
  const rect = page?.getBoundingClientRect();

  return { left: rect?.left ?? 0, width: rect?.width ?? viewportWidth, viewportWidth, viewportHeight };
};

/**
 * Where the page sits across the window, and the window's size: the page is narrower than the window while the panel
 * is docked beside it, and its breakpoints still follow the window, as its media queries do.
 */
const usePageBox = (pageRef: RefObject<HTMLElement | null>): PageBox => {
  const [box, setBox] = useState<PageBox>(() => measure(pageRef.current));

  useEffect(() => {
    const page = pageRef.current;
    const update = () => setBox(measure(page));
    update();
    window.addEventListener('resize', update);
    const observer = page ? new ResizeObserver(update) : undefined;
    if (page) {
      observer?.observe(page);
    }

    return () => {
      window.removeEventListener('resize', update);
      observer?.disconnect();
    };
  }, [pageRef]);

  return box;
};

export default usePageBox;
