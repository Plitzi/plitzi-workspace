import clsx from 'clsx';

import { ACCESS_LEVELS } from '../../types';

import type { AccessLevel } from '../../types';
import type { PointerEvent } from 'react';

const LEVELS: AccessLevel[] = ['everyone', 'guests', 'signedIn'];

const keepPress = (e: PointerEvent) => e.stopPropagation();

/** What the stripe down each card means, and the keys that move around the map. */
const SitemapLegend = () => (
  <div
    className="border-ui-line dark:bg-ui-panel/95 absolute top-3 right-3 z-20 flex w-44 flex-col gap-2 rounded-xl border bg-white/95 px-3 py-2.5 shadow-sm backdrop-blur"
    onPointerDown={keepPress}
  >
    <span className="text-ui-fg-subtle text-[11px] font-semibold tracking-wide uppercase">Who can open it</span>
    {LEVELS.map(level => (
      <span key={level} className="text-ui-fg flex items-center gap-2 text-xs">
        <span className={clsx('h-3 w-1 rounded-full', ACCESS_LEVELS[level].accent)} />
        {ACCESS_LEVELS[level].label}
      </span>
    ))}
    <span className="border-ui-line text-ui-fg-subtle mt-1 border-t pt-2 text-[11px] leading-relaxed">
      Drag a page onto a folder to move it. Double click opens it; arrows walk the map, Space folds.
    </span>
  </div>
);

export default SitemapLegend;
