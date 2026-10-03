import { LAYOUT_GRIDS, displayModeAt, layoutGridLook } from '@plitzi/sdk-shared/style';

import type { PageBox } from '../usePageBox';

export type QaGridProps = { box: PageBox };

/**
 * The layout grid over the page — the builder's, from the same definition — held to the viewport like a design tool's,
 * across the page's box rather than the window's when the panel is docked beside it.
 */
const QaGrid = ({ box }: QaGridProps) => {
  const look = layoutGridLook(LAYOUT_GRIDS[displayModeAt(box.viewportWidth)]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed top-0 bottom-0 z-[999998]"
      style={{ left: box.left, width: box.width }}
    >
      <div
        className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2"
        style={{ width: look.width, backgroundImage: look.backgroundImage, boxShadow: look.boxShadow }}
      />
    </div>
  );
};

export default QaGrid;
