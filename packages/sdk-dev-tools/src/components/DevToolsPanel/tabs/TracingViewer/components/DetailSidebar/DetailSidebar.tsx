import clsx from 'clsx';

import { formatMs, formatPercent, frameColor, HATCH_STYLE } from '../../helpers';

import type { FlameModel, FlameNode } from '../../helpers';
import type { CommitEntry } from '@plitzi/sdk-shared';

export type DetailSidebarProps = {
  node: FlameNode;
  commit: CommitEntry;
  model: FlameModel;
};

// The inner content of the detail panel (the resizable shell is provided by `SidebarShell`).
const DetailSidebar = ({ node, commit, model }: DetailSidebarProps) => (
  <>
    <div className="flex items-center gap-1.5">
      <span
        className={clsx('h-2.5 w-2.5 shrink-0 rounded-sm', frameColor(node))}
        style={node.state === 'hatched' ? HATCH_STYLE : undefined}
      />
      <span className="truncate text-xs font-medium text-zinc-700 dark:text-zinc-100">{node.name}</span>
      {!node.visible && <i className="fa-solid fa-eye-slash shrink-0 text-amber-500" title="Hidden via visibility" />}
    </div>
    <span className="truncate text-zinc-400 dark:text-zinc-500">{node.type}</span>
    {!node.visible && (
      <span className="w-fit rounded bg-amber-500/15 px-1 py-0.5 text-[9px] text-amber-600 dark:text-amber-400">
        hidden (visibility)
      </span>
    )}
    <span
      className={clsx('w-fit rounded px-1 py-0.5 text-[9px]', {
        'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400': node.state === 'rendered',
        'bg-zinc-500/15 text-zinc-500 dark:text-zinc-400': node.state !== 'rendered'
      })}
    >
      {node.state === 'rendered' && `rendered · ${node.phase ?? 'update'}`}
      {node.state === 'bubbled' && 'a descendant rendered'}
      {node.state === 'hatched' && 'did not render'}
    </span>
    {node.trigger && (
      <span
        className="w-fit rounded bg-violet-500/15 px-1 py-0.5 text-[9px] text-violet-600 dark:text-violet-400"
        title="A root cause of this commit — no ancestor re-rendered"
      >
        <i className="fa-solid fa-bolt mr-1" />
        trigger
      </span>
    )}

    <div className="mt-1 font-medium tracking-wide text-zinc-400 uppercase dark:text-zinc-500">Durations</div>
    <div className="flex justify-between gap-2">
      <span className="text-zinc-400 dark:text-zinc-500">Self</span>
      <span className="text-zinc-700 tabular-nums dark:text-zinc-200">{formatMs(node.selfDuration)}</span>
    </div>
    <div className="flex justify-between gap-2">
      <span className="text-zinc-400 dark:text-zinc-500">Total (subtree)</span>
      <span className="text-zinc-700 tabular-nums dark:text-zinc-200">{formatMs(node.actualDuration)}</span>
    </div>
    <div className="flex justify-between gap-2">
      <span className="text-zinc-400 dark:text-zinc-500">Base</span>
      <span className="text-zinc-700 tabular-nums dark:text-zinc-200">{formatMs(node.baseDuration)}</span>
    </div>
    <div className="flex justify-between gap-2">
      <span className="text-zinc-400 dark:text-zinc-500">% of commit</span>
      <span className="text-zinc-700 tabular-nums dark:text-zinc-200">
        {formatPercent(node.actualDuration / commit.duration)}
      </span>
    </div>
    {node.state === 'rendered' && (
      <div className="flex justify-between gap-2">
        <span className="text-zinc-400 dark:text-zinc-500">% of work</span>
        <span className="text-zinc-700 tabular-nums dark:text-zinc-200">
          {formatPercent(model.totalSelf > 0 ? node.selfDuration / model.totalSelf : 0)}
        </span>
      </div>
    )}

    <div className="mt-1 font-medium tracking-wide text-zinc-400 uppercase dark:text-zinc-500">
      Commit #{commit.commitId}
    </div>
    <div className="flex justify-between gap-2">
      <span className="text-zinc-400 dark:text-zinc-500">Committed at</span>
      <span className="text-zinc-700 tabular-nums dark:text-zinc-200">{(commit.timestamp / 1000).toFixed(1)}s</span>
    </div>
    <div className="flex justify-between gap-2">
      <span className="text-zinc-400 dark:text-zinc-500">Total</span>
      <span className="text-zinc-700 tabular-nums dark:text-zinc-200">{formatMs(commit.duration)}</span>
    </div>
    <div className="flex justify-between gap-2">
      <span className="text-zinc-400 dark:text-zinc-500">Rendered</span>
      <span className="text-zinc-700 tabular-nums dark:text-zinc-200">
        {model.renderedCount} of {commit.elementCount}
      </span>
    </div>
    <div className="flex justify-between gap-2">
      <span className="text-zinc-400 dark:text-zinc-500">Triggers</span>
      <span className="text-zinc-700 tabular-nums dark:text-zinc-200">{model.triggers.length}</span>
    </div>

    {node.state === 'rendered' && (
      <>
        <div className="mt-1 font-medium tracking-wide text-zinc-400 uppercase dark:text-zinc-500">Why it rendered</div>
        {node.changedProps === undefined && (
          <span className="text-zinc-400 italic dark:text-zinc-500">not captured</span>
        )}
        {node.changedProps?.length === 0 && node.phase === 'mount' && (
          <span className="text-zinc-400 italic dark:text-zinc-500">first mount</span>
        )}
        {node.changedProps?.length === 0 && node.phase !== 'mount' && node.trigger && (
          <span className="w-fit rounded bg-sky-500/15 px-1 py-0.5 text-[9px] text-sky-600 dark:text-sky-400">
            <i className="fa-solid fa-microchip mr-1" />
            internal: own state, a hook or a consumed context — not props or store
          </span>
        )}
        {node.changedProps?.length === 0 && node.phase !== 'mount' && !node.trigger && (
          <span className="w-fit rounded bg-amber-500/15 px-1 py-0.5 text-[9px] text-amber-600 dark:text-amber-400">
            <i className="fa-solid fa-triangle-exclamation mr-1" />
            no input changed — re-rendered by an ancestor
          </span>
        )}
        {node.changedProps?.map(change => (
          <div key={change.key} className="flex flex-col gap-0.5 border-l border-zinc-200 pl-1.5 dark:border-zinc-700">
            <span className="font-mono text-[9px] font-medium text-zinc-600 dark:text-zinc-300">{change.key}</span>
            <span className="flex items-center gap-1 font-mono text-[9px] text-zinc-400 dark:text-zinc-500">
              <span className="truncate" title={change.prev}>
                {change.prev}
              </span>
              <i className="fa-solid fa-arrow-right-long shrink-0 text-[8px]" />
              <span className="truncate text-zinc-600 dark:text-zinc-300" title={change.next}>
                {change.next}
              </span>
            </span>
          </div>
        ))}
      </>
    )}
  </>
);

export default DetailSidebar;
