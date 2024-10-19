// Packages
import React, { useMemo, use } from 'react';
import classNames from 'classnames';
import JsonView from '@uiw/react-json-view';
import { vscodeTheme } from '@uiw/react-json-view/vscode';

// Relatives
import DevToolsContext from '../../../../DevToolsContext.js';

const jsonViewStyle = {
  ...vscodeTheme,
  width: '100%',
  height: '100%',
  overflow: 'auto',
  padding: '8px',
  fontSize: '14px'
};

/**
 * @param {{
 *   className?: string;
 *   content?: string;
 *   elementSelected?: string;
 * }} props
 * @returns {React.ReactElement}
 */
const DataSourceViewer = props => {
  const { className, elementSelected } = props;
  const { getData } = use(DevToolsContext);
  const dataSource = useMemo(() => {
    if (!elementSelected || !getData) {
      return {};
    }

    return getData(`getElementDataSource-${elementSelected}`);
  }, [getData, elementSelected]);

  return (
    <div className={classNames('flex flex-col h-full w-full', className)}>
      <JsonView value={dataSource} style={jsonViewStyle} enableClipboard={false} indentWidth={2} collapsed={2} />
    </div>
  );
};

export default DataSourceViewer;
