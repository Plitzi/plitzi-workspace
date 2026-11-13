import clsx from 'clsx';
import { memo, useCallback, useState } from 'react';

import { preview } from '../../helpers';
import { STATE_COLUMNS } from '../../layout';
import UsedBy from '../UsedBy';
import ValueEditor from '../ValueEditor';

import type { Persistence, StateKeyUse } from '../../helpers';
import type { StateChange } from '../../hooks/useStateChanges';

export type StateRowProps = {
  use: StateKeyUse;
  value: unknown;
  persistence: Persistence;
  /** The key's last change while the panel is open: its row says it moved. */
  lastChange?: StateChange;
  onChange: (key: string, value: unknown) => void;
};

/**
 * One key of the state: its name, its value edited in place, how the settings keep it, and how many elements read and
 * write it — unfolded, each one a link.
 */
const StateRow = ({ use, value, persistence, lastChange, onChange }: StateRowProps) => {
  const [open, setOpen] = useState(false);
  const { key, reads, writes } = use;

  const handleChange = useCallback((next: unknown) => onChange(key, next), [key, onChange]);
  const handleToggle = useCallback(() => setOpen(current => !current), []);
  const isObject = typeof value === 'object' && value !== null;

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
        </button>
        <div className="min-w-0">
          {isObject ? (
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
        <span className="flex items-center justify-center gap-1 text-[11px]" title={persistence.reason}>
          {persistence.kept ? (
            <>
              <i className="fa-solid fa-check text-primary-text" aria-label="Kept" />
              {persistence.painted && (
                <i className="fa-solid fa-server text-ui-fg-subtle text-[9px]" aria-label="painted" />
              )}
              {persistence.browser && (
                <i className="fa-solid fa-globe text-ui-fg-subtle text-[9px]" aria-label="browser" />
              )}
            </>
          ) : (
            <span className="text-ui-fg-subtle" aria-label="Not kept">
              —
            </span>
          )}
        </span>
        <span
          className="text-ui-fg-subtle text-right text-[11px] whitespace-nowrap tabular-nums"
          title={`${String(reads.length)} element${reads.length === 1 ? '' : 's'} read it, ${String(writes.length)} write it`}
        >
          {reads.length}
          <span className="text-ui-line-strong mx-0.5">/</span>
          {writes.length}
        </span>
      </div>
      {open && (
        <div className="flex flex-col gap-1 pb-2 pl-7">
          {isObject && <ValueJson value={value} onChange={handleChange} />}
          <UsedBy reads={reads} writes={writes} />
        </div>
      )}
    </div>
  );
};

/** An object or a list, edited whole as JSON; applied when it is valid and left. */
const ValueJson = ({ value, onChange }: { value: unknown; onChange: (value: unknown) => void }) => {
  const [draft, setDraft] = useState(() => JSON.stringify(value, null, 2));
  const [invalid, setInvalid] = useState(false);

  const handleBlur = useCallback(() => {
    try {
      onChange(JSON.parse(draft));
      setInvalid(false);
    } catch {
      setInvalid(true);
    }
  }, [draft, onChange]);

  return (
    <div className="flex flex-col gap-1">
      <textarea
        className={clsx(
          'bg-ui-field text-ui-fg min-h-20 w-full rounded-sm border p-1.5 font-mono text-[11px] leading-snug outline-none',
          { 'border-red-500': invalid, 'border-ui-line-strong focus:border-primary-500': !invalid }
        )}
        spellCheck={false}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={handleBlur}
      />
      {invalid && <span className="text-[11px] text-red-600 dark:text-red-400">Not valid JSON: not applied.</span>}
    </div>
  );
};

export default memo(StateRow);
