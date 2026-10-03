import { use, useEffect, useState } from 'react';

import QaContext from '../QaContext';
import { tabOrderOf } from '../tabOrder';

/**
 * The order the Tab key walks the page's controls in, numbered on each — where a keyboard user goes next, and whether
 * that is where they would expect. Looked at again as the page scrolls, resizes or changes.
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
    const look = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setOrder(tabOrderOf(page));
        setFrame(previous => previous + 1);
      });
    };
    look();
    const observer = new MutationObserver(look);
    observer.observe(page, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['tabindex', 'disabled']
    });
    document.addEventListener('scroll', look, true);
    window.addEventListener('resize', look);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('scroll', look, true);
      window.removeEventListener('resize', look);
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
