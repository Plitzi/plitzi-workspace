import clsx from 'clsx';
import { memo, useCallback, useState } from 'react';

import { isBranch, preview, shapeOf, valueAt } from '../../helpers';
import { STATE_COLUMNS } from '../../layout';
import Kept from '../Kept';
import UseCounts from '../UseCounts';
import UsedBy from '../UsedBy';
import ValueEditor from '../ValueEditor';
import ValueJson from '../ValueJson';

import type { Persistence, StatePathUse } from '../../helpers';
import type { StateChange } from '../../hooks/useStateChanges';

export type StateRowProps = {
  use: StatePathUse;
  value: unknown;
  persistence: Persistence;
  /** The deepest paths the space names under the key, relative to it (`items.0.name`). */
  subPaths: string[];
  /** The last change of the key or of anything under it while the panel is open: its row says it moved. */
  lastChange?: StateChange;
  onChange: (key: string, value: unknown) => void;
  onOpenInTree: (key: string) => void;
};

/**
 * One top-level key of the state: its name — with what it holds (`{3}`, `[12]`) and how many paths under it the space
 * names — its value edited in place, how the settings keep it, and how many elements read and write it. Unfolded: the
 * paths under it with their values, a way into the tree, and each element that uses it as a link.
 */
const StateRow = ({ use, value, persistence, subPaths, lastChange, onChange, onOpenInTree }: StateRowProps) => {
  const [open, setOpen] = useState(false);
  const { path: key, reads, writes } = use;

  const handleChange = useCallback((next: unknown) => onChange(key, next), [key, onChange]);
  const handleToggle = useCallback(() => setOpen(current => !current), []);
  const handleOpenInTree = useCallback(() => onOpenInTree(key), [key, onOpenInTree]);
  const branch = isBranch(value);
  const shape = shapeOf(value);

  return (
    <div className="border-ui-line border-b last:border-b-0">
      <div className={clsx(STATE_COLUMNS, 'relative min-h-9 py-1 pr-2 pl-2')}>
        {/* A short glow on the row when the canvas just changed it: what the flow touched, seen as it happens. */}
        {lastChange && (
          <span
            key={lastChange.id}
            className="animate-state-flash bg-primary-400/25 pointer-events-none absolute inset-0"
            aria-hidden
          />
        )}
        <button
          type="button"
          aria-expanded={open}
          className="text-ui-fg flex min-w-0 cursor-pointer items-center gap-1.5 text-left font-mono text-xs"
          title={open ? 'Hide what reads and writes it' : 'Show what reads and writes it'}
          onClick={handleToggle}
        >
          <i
            className={clsx(
              'fa-solid text-ui-fg-subtle w-2.5 shrink-0 text-[8px]',
              open ? 'fa-chevron-down' : 'fa-chevron-right'
            )}
          />
          <span className="truncate">{key}</span>
          {shape && <span className="text-ui-fg-subtle shrink-0 text-[10px]">{shape}</span>}
          {subPaths.length > 0 && (
            <span
              className="text-ui-fg-subtle flex shrink-0 items-center gap-0.5 text-[10px]"
              title={`The space names ${String(subPaths.length)} path${subPaths.length === 1 ? '' : 's'} under it: ${subPaths.join(', ')}`}
            >
              <i className="fa-solid fa-folder-tree text-[9px]" aria-hidden />
              {subPaths.length}
            </span>
          )}
        </button>
        <div className="min-w-0">
          {branch ? (
            <button
              type="button"
              className="text-ui-fg-muted hover:bg-ui-hover block w-full cursor-pointer truncate rounded-sm px-1.5 py-0.5 text-left font-mono text-[11px]"
              title="Edit it as JSON"
              onClick={handleToggle}
            >
              {preview(value)}
            </button>
          ) : (
            <ValueEditor value={value} onChange={handleChange} />
          )}
        </div>
        <Kept persistence={persistence} />
        <UseCounts reads={reads} writes={writes} />
      </div>
      {open && (
        <div className="flex flex-col gap-1 pb-2 pl-7">
          {branch && <ValueJson value={value} onChange={handleChange} />}
          {(branch || subPaths.length > 0) && (
            <div className="flex flex-col gap-0.5 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-ui-fg-subtle text-[10px] font-semibold tracking-wider uppercase">
                  {subPaths.length > 0 ? 'Under it, as the space names it' : 'Under it'}
                </span>
                <button
                  type="button"
                  className="text-primary-text cursor-pointer pr-2 text-[11px] hover:underline"
                  onClick={handleOpenInTree}
                >
                  See it in the tree
                </button>
              </div>
              {subPaths.map(sub => (
                <div key={sub} className="flex items-baseline gap-2 font-mono text-[11px]">
                  <span className="text-ui-fg-muted shrink-0">
                    <span className="text-ui-fg-subtle">{key}.</span>
                    {sub}
                  </span>
                  <span className="text-ui-fg-subtle min-w-0 truncate">{preview(valueAt(value, sub.split('.')))}</span>
                </div>
              ))}
            </div>
          )}
          <UsedBy reads={reads} writes={writes} />
        </div>
      )}
    </div>
  );
};

export default memo(StateRow);
