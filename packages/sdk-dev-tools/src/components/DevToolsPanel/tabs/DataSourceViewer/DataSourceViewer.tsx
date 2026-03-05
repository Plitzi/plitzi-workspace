import JsonView from '@uiw/react-json-view';
import * as vscode from '@uiw/react-json-view/vscode';
import { use } from 'react';

import DevToolsContext from '@plitzi/sdk-shared/devTools/DevToolsContext';

const jsonViewStyle = {
  ...vscode.vscodeTheme,
  width: '100%',
  height: '100%',
  overflow: 'auto',
  padding: '8px',
  fontSize: '14px'
};

export type DataSourceViewerProps = {
  elementSelected?: string;
};

const DataSourceViewer = ({ elementSelected }: DataSourceViewerProps) => {
  const { getData } = use(DevToolsContext);

  return (
    <div className="flex h-full w-full flex-col">
      <JsonView
        value={elementSelected ? getData?.(`getElementDataSource-${elementSelected}`) : {}}
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

export default DataSourceViewer;
