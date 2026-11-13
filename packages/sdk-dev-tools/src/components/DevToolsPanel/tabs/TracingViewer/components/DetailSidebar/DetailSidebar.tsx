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
      <span className="text-ui-fg truncate text-xs font-medium">{node.name}</span>
      {!node.visible && <i className="fa-solid fa-eye-slash shrink-0 text-amber-500" title="Hidden via visibility" />}
    </div>
    <span className="text-ui-fg-subtle truncate">{node.type}</span>
    {!node.visible && (
      <span className="w-fit rounded bg-amber-500/15 px-1 py-0.5 text-[9px] text-amber-600 dark:text-amber-400">
        hidden (visibility)
      </span>
    )}
    <span
      className={clsx('w-fit rounded px-1 py-0.5 text-[9px]', {
        'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400': node.state === 'rendered',
        'text-ui-fg-subtle bg-zinc-500/15': node.state !== 'rendered'
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

    <div className="text-ui-fg-subtle mt-1 font-medium tracking-wide uppercase">Durations</div>
    <div className="flex justify-between gap-2">
      <span className="text-ui-fg-subtle">Self</span>
      <span className="text-ui-fg tabular-nums">{formatMs(node.selfDuration)}</span>
    </div>
    <div className="flex justify-between gap-2">
      <span className="text-ui-fg-subtle">Total (subtree)</span>
      <span className="text-ui-fg tabular-nums">{formatMs(node.actualDuration)}</span>
    </div>
    <div className="flex justify-between gap-2">
      <span className="text-ui-fg-subtle">Base</span>
      <span className="text-ui-fg tabular-nums">{formatMs(node.baseDuration)}</span>
    </div>
    <div className="flex justify-between gap-2">
      <span className="text-ui-fg-subtle">% of commit</span>
      <span className="text-ui-fg tabular-nums">{formatPercent(node.actualDuration / commit.duration)}</span>
    </div>
    {node.state === 'rendered' && (
      <div className="flex justify-between gap-2">
        <span className="text-ui-fg-subtle">% of work</span>
        <span className="text-ui-fg tabular-nums">
          {formatPercent(model.totalSelf > 0 ? node.selfDuration / model.totalSelf : 0)}
        </span>
      </div>
    )}

    <div className="text-ui-fg-subtle mt-1 font-medium tracking-wide uppercase">Commit #{commit.commitId}</div>
    <div className="flex justify-between gap-2">
      <span className="text-ui-fg-subtle">Committed at</span>
      <span className="text-ui-fg tabular-nums">{(commit.timestamp / 1000).toFixed(1)}s</span>
    </div>
    <div className="flex justify-between gap-2">
      <span className="text-ui-fg-subtle">Total</span>
      <span className="text-ui-fg tabular-nums">{formatMs(commit.duration)}</span>
    </div>
    <div className="flex justify-between gap-2">
      <span className="text-ui-fg-subtle">Rendered</span>
      <span className="text-ui-fg tabular-nums">
        {model.renderedCount} of {commit.elementCount}
      </span>
    </div>
    <div className="flex justify-between gap-2">
      <span className="text-ui-fg-subtle">Triggers</span>
      <span className="text-ui-fg tabular-nums">{model.triggers.length}</span>
    </div>

    {node.state === 'rendered' && (
      <>
        <div className="text-ui-fg-subtle mt-1 font-medium tracking-wide uppercase">Why it rendered</div>
        {node.phase === 'mount' && <span className="text-ui-fg-subtle italic">first mount</span>}
        {node.phase !== 'mount' && node.changedProps === undefined && (
          <span className="w-fit rounded bg-sky-500/15 px-1 py-0.5 text-[9px] text-sky-600 dark:text-sky-400">
            <i className="fa-solid fa-microchip mr-1" />
            internal React — own state or a hook (props & store inputs unchanged)
          </span>
        )}
        {node.phase !== 'mount' && node.changedProps?.length === 0 && node.trigger && (
          <span className="w-fit rounded bg-sky-500/15 px-1 py-0.5 text-[9px] text-sky-600 dark:text-sky-400">
            <i className="fa-solid fa-microchip mr-1" />
            internal — a hook or consumed context changed, not props or store
          </span>
        )}
        {node.phase !== 'mount' && node.changedProps?.length === 0 && !node.trigger && (
          <span className="w-fit rounded bg-amber-500/15 px-1 py-0.5 text-[9px] text-amber-600 dark:text-amber-400">
            <i className="fa-solid fa-triangle-exclamation mr-1" />
            no input changed — re-rendered by an ancestor
          </span>
        )}
        {node.changedProps?.map(change => (
          <div key={change.key} className="border-ui-line flex flex-col gap-0.5 border-l pl-1.5">
            <span className="flex flex-wrap items-center gap-1">
              <span className="text-ui-fg-muted font-mono text-[9px] font-medium break-all">{change.key}</span>
              {change.ref && (
                <span
                  className="shrink-0 rounded bg-amber-500/15 px-1 text-[8px] text-amber-600 dark:text-amber-400"
                  title="Reference changed but the content is shallow-equal — a new object/array, likely a missing memo"
                >
                  new ref
                </span>
              )}
            </span>
            <div className="flex flex-col gap-0.5 font-mono text-[9px] leading-snug">
              <span className="text-ui-fg-subtle break-all">
                <span className="text-rose-400/70 select-none dark:text-rose-400/60">− </span>
                {change.prev}
              </span>
              <span className="text-ui-fg-muted break-all">
                <span className="text-emerald-500/80 select-none">+ </span>
                {change.next}
              </span>
            </div>
          </div>
        ))}
      </>
    )}
  </>
);

export default DetailSidebar;
