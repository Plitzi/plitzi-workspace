import clsx from 'clsx';

import { ACCESS_LEVELS } from '../../types';

import type { AccessLevel } from '../../types';
import type { PointerEvent } from 'react';

const LEVELS: AccessLevel[] = ['everyone', 'guests', 'signedIn'];

const keepPress = (e: PointerEvent) => e.stopPropagation();

/** What the stripe down each card means, and the keys that move around the map. */
const SitemapLegend = () => (
  <div
    className="absolute top-3 right-3 z-20 flex w-44 flex-col gap-2 rounded-xl border border-gray-200 bg-white/95 px-3 py-2.5 shadow-sm backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/95"
    onPointerDown={keepPress}
  >
    <span className="text-[11px] font-semibold tracking-wide text-gray-500 uppercase dark:text-zinc-400">
      Who can open it
    </span>
    {LEVELS.map(level => (
      <span key={level} className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
        <span className={clsx('h-3 w-1 rounded-full', ACCESS_LEVELS[level].accent)} />
        {ACCESS_LEVELS[level].label}
      </span>
    ))}
    <span className="mt-1 border-t border-gray-200 pt-2 text-[11px] leading-relaxed text-gray-500 dark:border-zinc-700 dark:text-zinc-400">
      Drag a page onto a folder to move it. Double click opens it; arrows walk the map, Space folds.
    </span>
  </div>
);

export default SitemapLegend;
