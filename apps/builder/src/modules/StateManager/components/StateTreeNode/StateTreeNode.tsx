import clsx from 'clsx';
import { useCallback, useState } from 'react';

import { childOf, isBranch, preview, shapeOf } from '../../helpers';
import { STATE_COLUMNS } from '../../layout';
import Kept from '../Kept';
import UseCounts from '../UseCounts';
import UsedBy from '../UsedBy';
import ValueEditor from '../ValueEditor';
import ValueJson from '../ValueJson';

import type { Persistence, StatePathUse } from '../../helpers';
import type { StateChange } from '../../hooks/useStateChanges';

/** How many keys of a branch show at once: a list of hundreds unfolds a page at a time. */
const PAGE = 50;

const NO_USE: Pick<StatePathUse, 'reads' | 'writes' | 'children'> = { reads: [], writes: [], children: [] };

export type StateTreeNodeProps = {
  /** The keys from the state's root to this one: `cart`, `items`, `0`. */
  segments: [string, ...string[]];
  value: unknown;
  /** Every path the space uses, by its dotted name. */
  paths: Map<string, StatePathUse>;
  /** Only a top-level key has one: the settings keep keys, not what is under them. */
  persistence?: Persistence;
  lastOf: Map<string, StateChange>;
  /** The dotted paths unfolded. */
  open: ReadonlySet<string>;
  onToggle: (path: string) => void;
  onChange: (segments: [string, ...string[]], value: unknown) => void;
};

/**
 * The keys under a branch: those its value holds, then those the space names that it does not hold yet — a list's by
 * index only (`items.length` is not a key of the list's).
 */
const childrenOf = (value: unknown, declared: string[]): string[] => {
  const own = isBranch(value) ? Object.keys(value) : [];
  const missing = declared.filter(child => !own.includes(child) && (!Array.isArray(value) || /^\d+$/.test(child)));

  return [...own, ...missing];
};

/**
 * One path of the state in its tree: unfolded, the keys under it, each a row of its own, so a nested value is seen and
 * set where it is — a leaf writes its path alone (`cart.items.0.name`), never the whole of what holds it.
 */
const StateTreeNode = ({
  segments,
  value,
  paths,
  persistence,
  lastOf,
  open,
  onToggle,
  onChange
}: StateTreeNodeProps) => {
  const path = segments.join('.');
  const use = paths.get(path) ?? NO_USE;
  const children = childrenOf(value, use.children);
  const branch = isBranch(value) || children.length > 0;
  const unfolded = branch && open.has(path);
  const depth = segments.length - 1;
  const lastChange = lastOf.get(path);
  const [json, setJson] = useState(false);
  const [usage, setUsage] = useState(false);
  const [shown, setShown] = useState(PAGE);

  const handleToggle = useCallback(() => onToggle(path), [onToggle, path]);
  const handleChange = useCallback((next: unknown) => onChange(segments, next), [onChange, segments]);
  const handleJson = useCallback(() => setJson(current => !current), []);
  const handleUsage = useCallback(() => setUsage(current => !current), []);
  const shape = shapeOf(value);
  const name = segments[segments.length - 1];

  return (
    <div className={clsx({ 'border-ui-line border-b last:border-b-0': depth === 0 })}>
      {/* The indent is the name's alone: every row's value, kept and counts stay in the table's columns. */}
      <div className={clsx(STATE_COLUMNS, 'relative min-h-8 py-0.5 pr-2 pl-2')}>
        {lastChange && (
          <span
            key={lastChange.id}
            className="animate-state-flash bg-primary-400/25 pointer-events-none absolute inset-0"
            aria-hidden
          />
        )}
        {/* The guide down the left of a nested key: which branch it is under, at a glance. */}
        {depth > 0 && (
          <span
            className="bg-ui-line pointer-events-none absolute inset-y-0 w-px"
            style={{ left: 8 + (depth - 1) * 14 + 4 }}
            aria-hidden
          />
        )}
        {branch ? (
          <button
            type="button"
            aria-expanded={unfolded}
            className="text-ui-fg flex min-w-0 cursor-pointer items-center gap-1.5 text-left font-mono text-xs"
            style={{ paddingLeft: depth * 14 }}
            onClick={handleToggle}
          >
            <i
              className={clsx(
                'fa-solid text-ui-fg-subtle w-2.5 shrink-0 text-[8px]',
                unfolded ? 'fa-chevron-down' : 'fa-chevron-right'
              )}
            />
            <span className="truncate">{name}</span>
            {shape && <span className="text-ui-fg-subtle shrink-0 text-[10px]">{shape}</span>}
          </button>
        ) : (
          <span
            className="text-ui-fg flex min-w-0 items-center gap-1.5 font-mono text-xs"
            style={{ paddingLeft: depth * 14 }}
          >
            <span className="w-2.5 shrink-0" aria-hidden />
            <span className="truncate">{name}</span>
          </span>
        )}
        <div className="min-w-0">
          {isBranch(value) ? (
            <button
              type="button"
              aria-pressed={json}
              className="text-ui-fg-muted hover:bg-ui-hover block w-full cursor-pointer truncate rounded-sm px-1.5 py-0.5 text-left font-mono text-[11px]"
              title="Edit it as JSON"
              onClick={handleJson}
            >
              {preview(value)}
            </button>
          ) : (
            <ValueEditor value={value} onChange={handleChange} />
          )}
        </div>
        {persistence ? <Kept persistence={persistence} /> : <span />}
        <UseCounts reads={use.reads} writes={use.writes} onClick={handleUsage} />
      </div>
      {(json || usage) && (
        <div className="flex flex-col gap-1 pr-2 pb-2" style={{ paddingLeft: 8 + depth * 14 + 18 }}>
          {json && isBranch(value) && <ValueJson value={value} onChange={handleChange} />}
          {usage && <UsedBy reads={use.reads} writes={use.writes} />}
        </div>
      )}
      {unfolded && (
        <div className="flex flex-col">
          {children.slice(0, shown).map(child => (
            <StateTreeNode
              key={child}
              segments={[segments[0], ...segments.slice(1), child]}
              value={childOf(value, child)}
              paths={paths}
              lastOf={lastOf}
              open={open}
              onToggle={onToggle}
              onChange={onChange}
            />
          ))}
          {children.length === 0 && (
            <span className="text-ui-fg-subtle py-1 text-[11px]" style={{ paddingLeft: 8 + (depth + 1) * 14 + 18 }}>
              Empty
            </span>
          )}
          {children.length > shown && (
            <button
              type="button"
              className="text-primary-text cursor-pointer py-1 text-left text-[11px] hover:underline"
              style={{ paddingLeft: 8 + (depth + 1) * 14 + 18 }}
              onClick={() => setShown(current => current + PAGE)}
            >
              Show {Math.min(PAGE, children.length - shown)} more of {children.length}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default StateTreeNode;
