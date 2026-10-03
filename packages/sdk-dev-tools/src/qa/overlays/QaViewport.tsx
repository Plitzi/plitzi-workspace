import { displayModeAt } from '@plitzi/sdk-shared/style';

import type { PageBox } from '../usePageBox';

export type QaViewportProps = { box: PageBox };

/**
 * The window's size and the breakpoint whose rules the page shows at it — and the page's own width when the panel
 * docked beside it makes the two differ, which is when a layout looks wrong for a reason that is not the layout.
 */
const QaViewport = ({ box }: QaViewportProps) => {
  const narrower = Math.round(box.width) < box.viewportWidth;

  return (
    <div
      className="pointer-events-none fixed top-2 z-[999999] -translate-x-1/2 rounded-full bg-zinc-900/90 px-3 py-1 font-mono text-[11px] whitespace-nowrap text-white shadow-lg ring-1 ring-white/10"
      style={{ left: box.left + box.width / 2 }}
    >
      {box.viewportWidth} × {box.viewportHeight} ·{' '}
      <span className="text-violet-300">{displayModeAt(box.viewportWidth)}</span>
      {narrower && <span className="text-zinc-400"> · page {Math.round(box.width)}</span>}
    </div>
  );
};

export default QaViewport;
