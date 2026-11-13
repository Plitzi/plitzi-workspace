import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import JsonView from '@uiw/react-json-view';
import * as vscode from '@uiw/react-json-view/vscode';
import clsx from 'clsx';
import { use, useCallback, useMemo } from 'react';

import { DevToolsContext } from '@plitzi/sdk-shared/devTools/react';
import { emptyObject } from '@plitzi/sdk-shared/helpers';
import { useTheme } from '@plitzi/sdk-shared/theme/react';

import mapFunctionValues from './helpers/mapFunctionValues';
import renderFreshnessKey from './helpers/renderFreshnessKey';
import renderFunctionValue from './helpers/renderFunctionValue';
import { useFreshnessByStore, useSecondsClock } from '../../../../freshness';
import { useSelectedStore, useSelectedStoreEntry } from '../../../../scope/useScope';
import useStoreState from '../../../../scope/useStoreState';

import type { DevStoreEntry, PathFreshness } from '@plitzi/nexus';

type StoreView = 'own' | 'merged';

const jsonViewStyle = {
  ...vscode.vscodeTheme,
  width: '100%',
  height: '100%',
  overflow: 'auto',
  padding: '8px',
  fontSize: '14px'
};

const toggleClass = (active: boolean) =>
  clsx(
    'cursor-pointer rounded px-2 py-0.5 font-medium transition-colors',
    active
      ? 'bg-violet-500/15 text-violet-600 dark:text-violet-300'
      : 'text-ui-fg-subtle hover:bg-ui-hover/70 hover:text-ui-fg'
  );

export type StoreViewerProps = {
  elementSelected?: string;
};

const NO_RECORDS: Readonly<Record<string, PathFreshness>> = {};

const NO_STORES: ReadonlyArray<DevStoreEntry> = [];

const StoreViewer = ({ elementSelected }: StoreViewerProps) => {
  const { resolvedTheme } = useTheme();
  const { getData } = use(DevToolsContext);
  // The store picked in the header's scope dropdown (defaults to the active instance's root); its live state is shown.
  const selectedEntry = useSelectedStoreEntry();
  const selectedStore = useSelectedStore();
  // Own layer by default; the parent fall-through is merged in only when the user asks for it (scoped stores only).
  const [view, setView] = useStorage<StoreView>('plitzi-sdk.dev-tools.store.view', 'own');
  const storeState = useStoreState(elementSelected ? undefined : selectedStore, view === 'merged');

  const showOwn = useCallback(() => setView('own'), [setView]);
  const showMerged = useCallback(() => setView('merged'), [setView]);

  // With an element selected show its resolved data source; otherwise the store chosen in the header dropdown.
  const value = elementSelected ? getData?.(`getElementDataSource-${elementSelected}`) : storeState;
  const displayValue = useMemo(() => mapFunctionValues(value), [value]);

  /**
   * The freshness of the store being shown, marked on the tree itself — which of these paths is cached, and for how
   * much longer. The Cache tab is where they are all listed, whichever store they are in; here it is only ever this
   * store's OWN records, since what a scope inherits from its chain is recorded where it was written.
   */
  const shownStores = useMemo(() => (selectedEntry ? [selectedEntry] : NO_STORES), [selectedEntry]);
  const records = useFreshnessByStore(shownStores)[0]?.records ?? NO_RECORDS;
  const newest = useMemo(
    () => Object.values(records).reduce((latest, record) => Math.max(latest, record.updatedAt), 0),
    [records]
  );
  const now = useSecondsClock(Object.keys(records).length > 0, newest);
  const renderKeyName = useMemo(() => renderFreshnessKey(records, now), [records, now]);

  return (
    <div className="flex h-full w-full flex-col">
      {!elementSelected && (
        <div className="border-ui-line flex shrink-0 items-center gap-1 border-b px-2 py-1 text-[11px]">
          <span className="text-ui-fg-subtle mr-1">View</span>
          <button className={toggleClass(view === 'own')} onClick={showOwn} title="Only this scope's own layer">
            Own
          </button>
          <button
            className={toggleClass(view === 'merged')}
            onClick={showMerged}
            title="Own layer merged over the parent scope chain"
          >
            Merged
          </button>
        </div>
      )}
      <JsonView
        value={displayValue ?? emptyObject}
        style={resolvedTheme === 'dark' ? jsonViewStyle : undefined}
        enableClipboard={false}
        indentWidth={15}
        collapsed={2}
        displayObjectSize={false}
        displayDataTypes={false}
      >
        <JsonView.String render={renderFunctionValue} />
        <JsonView.KeyName render={renderKeyName} />
      </JsonView>
    </div>
  );
};

export default StoreViewer;
