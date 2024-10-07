// Packages
import React, { useMemo, use } from 'react';
import ReactJson from '@microlink/react-json-view';
import classNames from 'classnames';

// Relatives
import DevToolsContext from '../../../../DevToolsContext';

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
      <ReactJson
        style={{ width: '100%', height: '100%', overflow: 'auto', padding: '8px', fontSize: '12px' }}
        enableClipboard={false}
        indentWidth={2}
        collapsed={1}
        src={dataSource}
        theme="monokai"
      />
    </div>
  );
};

export default DataSourceViewer;
