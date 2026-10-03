import { use, useEffect, useState } from 'react';

import QaContext from '../QaContext';
import QaBoxModel from './QaBoxModel';
import QaMeasure from './QaMeasure';
import QaTooltip from './QaTooltip';

/**
 * The inspector over the page: point at an element for its box and how it is set; click to keep it in the QA tab —
 * the page's own click does not happen, so a link can be inspected without leaving; hold Alt over another for the
 * distances between them. Escape puts it away.
 */
const QaInspector = () => {
  const { pageRef, pinned, setPinned, setSetting } = use(QaContext);
  const [hovered, setHovered] = useState<Element | undefined>();
  const [measuring, setMeasuring] = useState(false);
  // Bumped when the page scrolls or resizes under the pointer, so the boxes are drawn where the elements went.
  const [, setFrame] = useState(0);

  useEffect(() => {
    const page = pageRef.current;
    if (!page) {
      return undefined;
    }

    const onPage = (target: EventTarget | null): target is Element =>
      target instanceof Element && page.contains(target);
    let frame = 0;
    const redraw = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setFrame(previous => previous + 1));
    };
    const handleMove = (event: PointerEvent) => {
      setMeasuring(event.altKey);
      setHovered(onPage(event.target) ? event.target : undefined);
    };
    const handleClick = (event: MouseEvent) => {
      if (!onPage(event.target)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setPinned(event.target);
    };
    const handleKey = (event: KeyboardEvent) => {
      setMeasuring(event.altKey);
      if (event.type === 'keydown' && event.key === 'Escape') {
        setSetting('inspect', false);
      }
    };
    document.addEventListener('pointermove', handleMove, true);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKey, true);
    document.addEventListener('keyup', handleKey, true);
    document.addEventListener('scroll', redraw, true);
    window.addEventListener('resize', redraw);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointermove', handleMove, true);
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('keydown', handleKey, true);
      document.removeEventListener('keyup', handleKey, true);
      document.removeEventListener('scroll', redraw, true);
      window.removeEventListener('resize', redraw);
    };
  }, [pageRef, setPinned, setSetting]);

  const kept = pinned?.isConnected ? pinned : undefined;
  const pinnedRect = kept?.getBoundingClientRect();

  return (
    <>
      {pinnedRect && (
        <div
          className="pointer-events-none fixed z-[999998] box-border outline-2 outline-violet-500"
          style={{ left: pinnedRect.left, top: pinnedRect.top, width: pinnedRect.width, height: pinnedRect.height }}
        />
      )}
      {hovered && hovered !== kept && <QaBoxModel element={hovered} />}
      {kept && hovered && hovered !== kept && measuring && <QaMeasure from={kept} to={hovered} />}
      {hovered && !measuring && <QaTooltip element={hovered} />}
    </>
  );
};

export default QaInspector;
