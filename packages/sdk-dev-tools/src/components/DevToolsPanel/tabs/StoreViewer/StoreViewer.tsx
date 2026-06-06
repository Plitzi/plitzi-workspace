import JsonView from '@uiw/react-json-view';
import * as vscode from '@uiw/react-json-view/vscode';
import { use } from 'react';

import DevToolsContext from '@plitzi/sdk-shared/devTools/DevToolsContext';
import { emptyObject } from '@plitzi/sdk-shared/helpers/utils';
import { createStoreHook } from '@plitzi/sdk-store/createStore';

import type { CommonState } from '@plitzi/sdk-shared';

const jsonViewStyle = {
  ...vscode.vscodeTheme,
  width: '100%',
  height: '100%',
  overflow: 'auto',
  padding: '8px',
  fontSize: '14px'
};

export type StoreViewerProps = {
  elementSelected?: string;
};

const StoreViewer = ({ elementSelected }: StoreViewerProps) => {
  const { getData } = use(DevToolsContext);
  const { useStore } = createStoreHook<CommonState>();
  const [state] = useStore();

  // With an element selected show its resolved data source; otherwise the whole store.
  const value = elementSelected ? getData?.(`getElementDataSource-${elementSelected}`) : state;

  return (
    <div className="flex h-full w-full flex-col">
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
