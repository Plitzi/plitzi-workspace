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
    <aside className="border-ui-line bg-ui-panel flex w-52 shrink-0 flex-col gap-1.5 overflow-auto border-l px-3 py-2 text-[10px]">
      <div className="flex items-center gap-1.5">
        <span className={clsx('h-2.5 w-2.5 shrink-0 rounded-sm', durationColor(row.maxSelf))} />
        <span className="text-ui-fg truncate text-xs font-medium">{row.name}</span>
        {!visible && <i className="fa-solid fa-eye-slash shrink-0 text-amber-500" title="Hidden via visibility" />}
      </div>
      <span className="text-ui-fg-subtle truncate">{row.type}</span>
      {!visible && (
        <span className="w-fit rounded bg-amber-500/15 px-1 py-0.5 text-[9px] text-amber-600 dark:text-amber-400">
          hidden (visibility)
        </span>
      )}

      <div className="text-ui-fg-subtle mt-1 font-medium tracking-wide uppercase">Renders (session)</div>
      <div className="flex justify-between gap-2">
        <span className="text-ui-fg-subtle">Total</span>
        <span className="text-ui-fg tabular-nums">{row.renders}×</span>
      </div>
      <div className="flex justify-between gap-2">
        <span className="text-ui-fg-subtle">Mounts</span>
        <span className="text-ui-fg tabular-nums">{row.mounts}</span>
      </div>
      <div className="flex justify-between gap-2">
        <span className="text-ui-fg-subtle">Updates</span>
        <span className="text-ui-fg tabular-nums">{row.renders - row.mounts}</span>
      </div>

      <div className="text-ui-fg-subtle mt-1 font-medium tracking-wide uppercase">Self time</div>
      <div className="flex justify-between gap-2">
        <span className="text-ui-fg-subtle">Total</span>
        <span className="text-ui-fg tabular-nums">{formatMs(row.totalSelf)}</span>
      </div>
      <div className="flex justify-between gap-2">
        <span className="text-ui-fg-subtle">Average</span>
        <span className="text-ui-fg tabular-nums">{formatMs(row.avgSelf)}</span>
      </div>
      <div className="flex justify-between gap-2">
        <span className="text-ui-fg-subtle">Max</span>
        <span className="text-ui-fg tabular-nums">{formatMs(row.maxSelf)}</span>
      </div>
      <div className="flex justify-between gap-2">
        <span className="text-ui-fg-subtle">Last</span>
        <span className="text-ui-fg tabular-nums">{formatMs(row.lastSelf)}</span>
      </div>
      <div className="flex justify-between gap-2">
        <span className="text-ui-fg-subtle">% of session</span>
        <span className="text-ui-fg tabular-nums">
          {formatPercent(sessionSelf > 0 ? row.totalSelf / sessionSelf : 0)}
        </span>
      </div>
    </aside>
  );
};

export default HotspotSidebar;
