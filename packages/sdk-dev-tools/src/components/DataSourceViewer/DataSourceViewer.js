// Packages
import React from 'react';
import ReactJson from '@microlink/react-json-view';

// Monorepo
// import useDataSource from '@plitzi/sdk-data-source/hooks/useDataSource';

// Relatives
// import DevToolsContext from '../../DevToolsContext';

/**
 * @param {{
 *   className?: string;
 *   content?: string;
 * }} props
 * @returns {React.ReactElement}
 */
const DataSourceViewer = props => {
  const { content } = props;
  // const [id, setId] = useState('');
  // const { getData } = use(DevToolsContext);

  // const dataSource = useMemo(() => getData('useDataSource', { mode: 'read' }), [getData]);
  // const dataSource = useDataSource({ id, mode: 'read' });
  // console.log(dataSource);

  return (
    <div className="flex h-full w-full">
      <ReactJson style={{ width: '100%' }} src={content} theme="monokai" />
    </div>
  );
};

export default DataSourceViewer;
