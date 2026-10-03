import { use, useEffect, useState } from 'react';

import QaContext from '../QaContext';
import { tabOrderOf } from '../tabOrder';

/** How long the page has to stay still before the order is worked out again. */
const REORDER_AFTER_MS = 200;

/**
 * The order the Tab key walks the page's controls in, numbered on each — where a keyboard user goes next, and whether
 * that is where they would expect.
 */
const QaTabOrder = () => {
  const { pageRef } = use(QaContext);
  const [order, setOrder] = useState<Element[]>([]);
  const [, setFrame] = useState(0);

  useEffect(() => {
    const page = pageRef.current;
    if (!page) {
      return undefined;
    }

    let frame = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // The order is worked out again when the page changes, once it has settled; a scroll only moves the numbers.
    const reorder = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setOrder(tabOrderOf(page)), REORDER_AFTER_MS);
    };
    const redraw = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setFrame(previous => previous + 1));
    };
    reorder();
    const observer = new MutationObserver(reorder);
    observer.observe(page, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['tabindex', 'disabled']
    });
    document.addEventListener('scroll', redraw, true);
    window.addEventListener('resize', reorder);

    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('scroll', redraw, true);
      window.removeEventListener('resize', reorder);
    };
  }, [pageRef]);

  return (
    <>
      {order.map((element, index) => {
        const rect = element.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > window.innerHeight) {
          return null;
        }

        return (
          <span
            key={index}
            className="pointer-events-none fixed z-[999998] flex h-[18px] min-w-[18px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-sky-600 px-1 font-mono text-[10px] font-semibold text-white shadow ring-2 ring-white/80"
            style={{ left: rect.left, top: rect.top }}
          >
            {index + 1}
          </span>
        );
      })}
    </>
  );
};

export default QaTabOrder;
