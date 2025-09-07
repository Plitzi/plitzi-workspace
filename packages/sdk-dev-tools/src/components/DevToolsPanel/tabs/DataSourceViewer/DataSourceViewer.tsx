import JsonView from '@uiw/react-json-view';
import { vscodeTheme } from '@uiw/react-json-view/vscode';
import { useMemo, use } from 'react';

import DevToolsContext from '../../../../DevToolsContext';

const jsonViewStyle = {
  ...vscodeTheme,
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
  const dataSource = useMemo(() => {
    if (!elementSelected || !getData) {
      return {};
    }

    return getData(`getElementDataSource-${elementSelected}`);
  }, [getData, elementSelected]);

  return (
    <div className="flex flex-col h-full w-full">
      <JsonView value={dataSource} style={jsonViewStyle} enableClipboard={false} indentWidth={2} collapsed={2} />
    </div>
  );
};

export default DataSourceViewer;
