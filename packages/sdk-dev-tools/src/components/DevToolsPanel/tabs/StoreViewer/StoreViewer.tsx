import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import JsonView from '@uiw/react-json-view';
import * as vscode from '@uiw/react-json-view/vscode';
import clsx from 'clsx';
import { use, useCallback } from 'react';

import DevToolsContext from '@plitzi/sdk-shared/devTools/DevToolsContext';
import { emptyObject } from '@plitzi/sdk-shared/helpers/utils';

import { useSelectedStore } from '../../../../scope/useScope';
import useStoreState from '../../../../scope/useStoreState';

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
      : 'text-zinc-500 hover:bg-zinc-200/70 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700/50 dark:hover:text-zinc-100'
  );

export type StoreViewerProps = {
  elementSelected?: string;
};

const StoreViewer = ({ elementSelected }: StoreViewerProps) => {
  const { getData } = use(DevToolsContext);
  // The store picked in the header's scope dropdown (defaults to the active instance's root); its live state is shown.
  const selectedStore = useSelectedStore();
  // Own layer by default; the parent fall-through is merged in only when the user asks for it (scoped stores only).
  const [view, setView] = useStorage<StoreView>('plitzi-sdk.dev-tools.store.view', 'own');
  const storeState = useStoreState(elementSelected ? undefined : selectedStore, view === 'merged');

  const showOwn = useCallback(() => setView('own'), [setView]);
  const showMerged = useCallback(() => setView('merged'), [setView]);

  // With an element selected show its resolved data source; otherwise the store chosen in the header dropdown.
  const value = elementSelected ? getData?.(`getElementDataSource-${elementSelected}`) : storeState;

  return (
    <div className="flex h-full w-full flex-col">
      {!elementSelected && (
        <div className="flex shrink-0 items-center gap-1 border-b border-zinc-200 px-2 py-1 text-[11px] dark:border-zinc-800">
          <span className="mr-1 text-zinc-400 dark:text-zinc-500">View</span>
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
        value={value ?? emptyObject}
        style={jsonViewStyle}
        enableClipboard={false}
        indentWidth={15}
        collapsed={2}
        displayObjectSize={false}
        displayDataTypes={false}
      />
    </div>
  );
};

export default StoreViewer;
