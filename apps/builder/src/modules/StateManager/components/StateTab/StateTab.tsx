import Input from '@plitzi/plitzi-ui/Input';
import clsx from 'clsx';
import { useCallback, useMemo, useState } from 'react';

import { useBuilderStore } from '@plitzi/sdk-shared/store';

import { persistenceOf, preview, setInState, statePathsOf, subPathsOf, topKeysOf } from '../../helpers';
import useStateChanges from '../../hooks/useStateChanges';
import { STATE_COLUMNS } from '../../layout';
import StateJson from '../StateJson';
import StateRow from '../StateRow';
import StateTreeNode from '../StateTreeNode';

import type { StatePathUse } from '../../helpers';

const NO_STATE: Record<string, unknown> = {};

type Mode = 'table' | 'tree' | 'json';

const MODES: { mode: Mode; label: string; hint: string }[] = [
  { mode: 'table', label: 'Table', hint: 'One row per key, what is under it summed up' },
  { mode: 'tree', label: 'Tree', hint: 'Every key under another unfolded, each set where it is' },
  { mode: 'json', label: 'JSON', hint: 'The whole state as JSON' }
];

/**
 * The page's state as the canvas runs it: every key the space reads or writes — set or not yet — each edited in place,
 * then the keys the page holds that nothing in the space names. As a table, a row per top-level key; as a tree, what is
 * under each one unfolded and set where it is; or the whole of it as JSON. What changes as the canvas
 * runs is listed under, newest first. Nothing here is saved: it is the page's state, not the space's.
 */
const StateTab = () => {
  const [[state = NO_STATE, flat, components, settings]] = useBuilderStore([
    'runtime.state',
    'schema.flat',
    'schema.components',
    'schema.settings'
  ]);
  const [, setState] = useBuilderStore('runtime.state');
  const [mode, setMode] = useState<Mode>('table');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const { changes, lastOf, clear } = useStateChanges(state);

  const paths = useMemo(() => statePathsOf({ flat, components }), [flat, components]);
  const used = useMemo(() => topKeysOf(paths), [paths]);
  const { declared, loose } = useMemo(() => {
    const needle = query.trim().toLowerCase();
    // A key is found by its name or by a path the space names under it (`total` finds `cart`).
    const matches = (key: string) =>
      key.toLowerCase().includes(needle) ||
      [...paths.keys()].some(path => path.startsWith(`${key}.`) && path.toLowerCase().includes(needle));
    // What the page holds first: the keys it has set, then those waiting for a value — each by name.
    const byName = (a: StatePathUse, b: StatePathUse) =>
      Number(state[a.path] === undefined) - Number(state[b.path] === undefined) || a.path.localeCompare(b.path);

    return {
      declared: [...used.values()].filter(each => !needle || matches(each.path)).sort(byName),
      loose: Object.keys(state)
        .filter(key => !used.has(key) && (!needle || matches(key)))
        .sort()
        .map((key): StatePathUse => ({ path: key, reads: [], writes: [], children: [] }))
    };
  }, [used, paths, state, query]);

  const handleChange = useCallback(
    (key: string, value: unknown) => setState({ ...state, [key]: value }),
    [setState, state]
  );

  const handleTreeChange = useCallback(
    (segments: [string, ...string[]], value: unknown) => setState(setInState(state, segments, value)),
    [setState, state]
  );

  const handleToggle = useCallback(
    (path: string) =>
      setOpen(current => {
        const next = new Set(current);
        if (!next.delete(path)) {
          next.add(path);
        }

        return next;
      }),
    []
  );

  // From a row of the table: the tree, with the key unfolded down to every path the space names under it.
  const handleOpenInTree = useCallback(
    (key: string) => {
      const branches = [...paths.values()]
        .filter(use => (use.path === key || use.path.startsWith(`${key}.`)) && use.children.length > 0)
        .map(use => use.path);
      setOpen(current => new Set([...current, key, ...branches]));
      setMode('tree');
    },
    [paths]
  );

  const row = (use: StatePathUse) =>
    mode === 'tree' ? (
      <StateTreeNode
        key={use.path}
        segments={[use.path]}
        value={state[use.path]}
        paths={paths}
        persistence={persistenceOf(settings, use.path)}
        lastOf={lastOf}
        open={open}
        onToggle={handleToggle}
        onChange={handleTreeChange}
      />
    ) : (
      <StateRow
        key={use.path}
        use={use}
        value={state[use.path]}
        persistence={persistenceOf(settings, use.path)}
        subPaths={subPathsOf(paths, use.path)}
        lastChange={lastOf.get(use.path)}
        onChange={handleChange}
        onOpenInTree={handleOpenInTree}
      />
    );

  return (
    <div className="flex min-h-0 grow flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="grow">
          <Input size="xs" value={query} placeholder="Find a key" aria-label="Find a key" clearable onChange={setQuery}>
            <Input.Icon icon="fa-solid fa-magnifying-glass" />
          </Input>
        </div>
        <div className="bg-ui-raised flex shrink-0 gap-0.5 rounded-md p-0.5" role="tablist" aria-label="How to show it">
          {MODES.map(each => (
            <button
              key={each.mode}
              type="button"
              role="tab"
              aria-selected={mode === each.mode}
              title={each.hint}
              className={clsx('cursor-pointer rounded px-2 py-0.5 text-[11px] font-medium', {
                'bg-ui-active text-ui-fg shadow-sm': mode === each.mode,
                'text-ui-fg-subtle hover:text-ui-fg': mode !== each.mode
              })}
              onClick={() => setMode(each.mode)}
            >
              {each.label}
            </button>
          ))}
        </div>
      </div>
      {mode === 'json' && <StateJson state={state} onApply={setState} />}
      {mode !== 'json' && (
        <div className="flex min-h-0 grow basis-0 flex-col overflow-y-auto">
          <p className="text-ui-fg-subtle flex flex-wrap items-center gap-x-3 gap-y-0.5 px-2 pb-1.5 text-[10px]">
            <span>
              <i className="fa-solid fa-check text-primary-text mr-1" />
              kept between visits
            </span>
            <span>
              <i className="fa-solid fa-server mr-1" />
              drawn by the server too
            </span>
            <span>
              <i className="fa-solid fa-globe mr-1" />
              kept by the browser
            </span>
            <span>— not kept · not set</span>
            <span className="font-mono">{'{3}'}</span>
            <span className="-ml-2.5">an object of 3 keys</span>
            <span className="font-mono">[3]</span>
            <span className="-ml-2.5">a list of 3</span>
            {mode === 'table' && (
              <span>
                <i className="fa-solid fa-folder-tree mr-1" />
                paths under it the space names
              </span>
            )}
          </p>
          <div
            className={clsx(
              STATE_COLUMNS,
              'bg-ui-panel border-ui-line text-ui-fg-subtle sticky top-0 z-1 border-b px-2 py-1.5 text-[10px] font-semibold tracking-wider whitespace-nowrap uppercase'
            )}
          >
            <span>Key</span>
            <span>Value</span>
            <span className="text-center" title="Kept between visits, as the space's settings say (keepState)">
              Kept
            </span>
            <span className="text-right" title="How many elements read it / write it">
              Reads / writes
            </span>
          </div>
          <section className="flex flex-col">
            <h6 className="text-ui-fg-subtle flex h-7 items-center justify-between px-2 text-[10px] font-semibold tracking-wider uppercase">
              Used by the space
              <span className="font-normal tabular-nums">{declared.length}</span>
            </h6>
            {declared.map(row)}
            {declared.length === 0 && (
              <p className="text-ui-fg-subtle px-2 py-3 text-xs">
                {query ? 'No key matches.' : 'Nothing in the space reads or writes the state yet.'}
              </p>
            )}
          </section>
          {loose.length > 0 && (
            <section className="mt-2 flex flex-col">
              <h6 className="text-ui-fg-subtle flex h-7 items-center justify-between px-2 text-[10px] font-semibold tracking-wider uppercase">
                In the state, named by nothing
                <span className="font-normal tabular-nums">{loose.length}</span>
              </h6>
              {loose.map(row)}
            </section>
          )}
          <section className="border-ui-line mt-3 flex flex-col border-t pt-2">
            <h6 className="text-ui-fg-subtle flex h-7 items-center justify-between px-2 text-[10px] font-semibold tracking-wider uppercase">
              Last changes
              {changes.length > 0 && (
                <button
                  type="button"
                  className="text-ui-fg-subtle hover:text-ui-fg cursor-pointer normal-case"
                  onClick={clear}
                >
                  Clear
                </button>
              )}
            </h6>
            {changes.length === 0 && (
              <p className="text-ui-fg-subtle px-2 pb-2 text-xs">
                Use the page on the canvas: what it changes shows here.
              </p>
            )}
            {changes.map(change => (
              <div key={change.id} className="flex items-center gap-2 px-2 py-1 font-mono text-[11px]">
                <span className="text-ui-fg shrink-0">{change.path}</span>
                <span
                  className="text-ui-fg-subtle min-w-0 truncate"
                  title={`${preview(change.from)} → ${preview(change.to)}`}
                >
                  {preview(change.from)} → <span className="text-ui-fg-muted">{preview(change.to)}</span>
                </span>
              </div>
            ))}
          </section>
        </div>
      )}
    </div>
  );
};

export default StateTab;
