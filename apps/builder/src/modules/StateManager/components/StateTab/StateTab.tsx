import Input from '@plitzi/plitzi-ui/Input';
import clsx from 'clsx';
import { useCallback, useMemo, useState } from 'react';

import { useBuilderStore } from '@plitzi/sdk-shared/store';

import { persistenceOf, preview, stateKeysOf } from '../../helpers';
import useStateChanges from '../../hooks/useStateChanges';
import { STATE_COLUMNS } from '../../layout';
import StateJson from '../StateJson';
import StateRow from '../StateRow';

import type { StateKeyUse } from '../../helpers';

const NO_STATE: Record<string, unknown> = {};

/**
 * The page's state as the canvas runs it: every key the space reads or writes — set or not yet — each edited in place,
 * then the keys the page holds that nothing in the space names; or the whole of it as JSON. What changes as the canvas
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
  const [mode, setMode] = useState<'table' | 'json'>('table');
  const [query, setQuery] = useState('');
  const { changes, lastOf, clear } = useStateChanges(state);

  const used = useMemo(() => stateKeysOf({ flat, components }), [flat, components]);
  const { declared, loose } = useMemo(() => {
    const matches = (key: string) => key.toLowerCase().includes(query.trim().toLowerCase());
    // What the page holds first: the keys it has set, then those waiting for a value — each by name.
    const byName = (a: StateKeyUse, b: StateKeyUse) =>
      Number(state[a.key] === undefined) - Number(state[b.key] === undefined) || a.key.localeCompare(b.key);

    return {
      declared: [...used.values()].filter(each => matches(each.key)).sort(byName),
      loose: Object.keys(state)
        .filter(key => !used.has(key) && matches(key))
        .sort()
        .map((key): StateKeyUse => ({ key, reads: [], writes: [] }))
    };
  }, [used, state, query]);

  const handleChange = useCallback(
    (key: string, value: unknown) => setState({ ...state, [key]: value }),
    [setState, state]
  );

  const row = (use: StateKeyUse) => (
    <StateRow
      key={use.key}
      use={use}
      value={state[use.key]}
      persistence={persistenceOf(settings, use.key)}
      lastChange={lastOf.get(use.key)}
      onChange={handleChange}
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
          {(['table', 'json'] as const).map(each => (
            <button
              key={each}
              type="button"
              role="tab"
              aria-selected={mode === each}
              className={clsx('cursor-pointer rounded px-2 py-0.5 text-[11px] font-medium', {
                'bg-ui-active text-ui-fg shadow-sm': mode === each,
                'text-ui-fg-subtle hover:text-ui-fg': mode !== each
              })}
              onClick={() => setMode(each)}
            >
              {each === 'table' ? 'Keys' : 'JSON'}
            </button>
          ))}
        </div>
      </div>
      {mode === 'json' && <StateJson state={state} onApply={setState} />}
      {mode === 'table' && (
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
                <span className="text-ui-fg shrink-0">{change.key}</span>
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
