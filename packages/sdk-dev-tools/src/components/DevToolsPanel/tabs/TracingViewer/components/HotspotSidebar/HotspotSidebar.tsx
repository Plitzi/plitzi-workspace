import clsx from 'clsx';

import { durationColor, elementVisible, formatMs, formatPercent } from '../../helpers';

import type { HotspotRow } from '../../helpers';
import type { Element } from '@plitzi/sdk-shared';

export type HotspotSidebarProps = {
  row: HotspotRow;
  flat: Record<string, Element> | undefined;
  sessionSelf: number; // Σ total self across all hotspots — denominator for the session share
};

const HotspotSidebar = ({ row, flat, sessionSelf }: HotspotSidebarProps) => {
  const visible = elementVisible(row.id, flat);

  return (
    <aside className="flex w-52 shrink-0 flex-col gap-1.5 overflow-auto border-l border-zinc-200 bg-zinc-50 px-3 py-2 text-[10px] dark:border-zinc-800 dark:bg-zinc-900/50">
      <div className="flex items-center gap-1.5">
        <span className={clsx('h-2.5 w-2.5 shrink-0 rounded-sm', durationColor(row.maxSelf))} />
        <span className="truncate text-xs font-medium text-zinc-700 dark:text-zinc-100">{row.name}</span>
        {!visible && <i className="fa-solid fa-eye-slash shrink-0 text-amber-500" title="Hidden via visibility" />}
      </div>
      <span className="truncate text-zinc-400 dark:text-zinc-500">{row.type}</span>
      {!visible && (
        <span className="w-fit rounded bg-amber-500/15 px-1 py-0.5 text-[9px] text-amber-600 dark:text-amber-400">
          hidden (visibility)
        </span>
      )}

      <div className="mt-1 font-medium tracking-wide text-zinc-400 uppercase dark:text-zinc-500">Renders (session)</div>
      <div className="flex justify-between gap-2">
        <span className="text-zinc-400 dark:text-zinc-500">Total</span>
        <span className="text-zinc-700 tabular-nums dark:text-zinc-200">{row.renders}×</span>
      </div>
      <div className="flex justify-between gap-2">
        <span className="text-zinc-400 dark:text-zinc-500">Mounts</span>
        <span className="text-zinc-700 tabular-nums dark:text-zinc-200">{row.mounts}</span>
      </div>
      <div className="flex justify-between gap-2">
        <span className="text-zinc-400 dark:text-zinc-500">Updates</span>
        <span className="text-zinc-700 tabular-nums dark:text-zinc-200">{row.renders - row.mounts}</span>
      </div>

      <div className="mt-1 font-medium tracking-wide text-zinc-400 uppercase dark:text-zinc-500">Self time</div>
      <div className="flex justify-between gap-2">
        <span className="text-zinc-400 dark:text-zinc-500">Total</span>
        <span className="text-zinc-700 tabular-nums dark:text-zinc-200">{formatMs(row.totalSelf)}</span>
      </div>
      <div className="flex justify-between gap-2">
        <span className="text-zinc-400 dark:text-zinc-500">Average</span>
        <span className="text-zinc-700 tabular-nums dark:text-zinc-200">{formatMs(row.avgSelf)}</span>
      </div>
      <div className="flex justify-between gap-2">
        <span className="text-zinc-400 dark:text-zinc-500">Max</span>
        <span className="text-zinc-700 tabular-nums dark:text-zinc-200">{formatMs(row.maxSelf)}</span>
      </div>
      <div className="flex justify-between gap-2">
        <span className="text-zinc-400 dark:text-zinc-500">Last</span>
        <span className="text-zinc-700 tabular-nums dark:text-zinc-200">{formatMs(row.lastSelf)}</span>
      </div>
      <div className="flex justify-between gap-2">
        <span className="text-zinc-400 dark:text-zinc-500">% of session</span>
        <span className="text-zinc-700 tabular-nums dark:text-zinc-200">
          {formatPercent(sessionSelf > 0 ? row.totalSelf / sessionSelf : 0)}
        </span>
      </div>
    </aside>
  );
};

export default HotspotSidebar;
