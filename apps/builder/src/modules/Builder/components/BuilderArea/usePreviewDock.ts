import { useLayoutEffect, useState } from 'react';

import { GUTTER, PANEL_WIDTH } from './previewDockRoom';

import type { RefObject } from 'react';

/**
 * Whether the space right of the canvas holds the visitor panel: the canvas is centred in its container and capped at
 * its device's width, so what is left on its right is half of what it does not take. Measured as both are resized.
 */
const usePreviewDock = (container: RefObject<HTMLDivElement | null>, wanted: boolean): boolean => {
  const [fits, setFits] = useState(false);

  useLayoutEffect(() => {
    const root = container.current;
    if (!wanted || !root) {
      setFits(false);

      return undefined;
    }

    const measure = () => {
      const area = root.querySelector<HTMLElement>(':scope > .builder-area');
      const free = area ? (root.clientWidth - area.offsetWidth) / 2 : 0;
      setFits(free >= PANEL_WIDTH + GUTTER * 2);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    const area = root.querySelector(':scope > .builder-area');
    if (area) {
      observer.observe(area);
    }

    measure();

    return () => observer.disconnect();
  }, [container, wanted]);

  return fits;
};

export default usePreviewDock;
