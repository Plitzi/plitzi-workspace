// Packages
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import throttle from 'lodash/throttle';
import ReactJson from '@microlink/react-json-view';
import classNames from 'classnames';

// Monorepo
import useDataSource from '@plitzi/sdk-data-source/hooks/useDataSource';

/**
 * @param {{
 *   className?: string;
 *   content?: string;
 * }} props
 * @returns {React.ReactElement}
 */
const DataSourceViewer = props => {
  const { className } = props;
  const [id, setId] = useState('');
  const dataSource = useDataSource({ id, mode: 'read' });

  const handleElementHovered = useCallback(elementDOM => {
    const { id: elementId } = elementDOM?.dataset ?? {};
    setId(elementId);
  }, []);

  const callbackPositionDebounced = useMemo(() => throttle(handleElementHovered, 50), [handleElementHovered]);
  const handleMouseMove = useCallback(
    e => {
      const closest = e.target.closest('.plitzi-sdk');
      if (!closest) {
        return;
      }

      callbackPositionDebounced(e.target);
    },
    [callbackPositionDebounced]
  );

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [handleMouseMove]);

  return (
    <div className={classNames('flex h-full w-full', className)}>
      <ReactJson
        style={{ width: '100%', height: '100%', overflow: 'auto' }}
        enableClipboard={false}
        src={dataSource}
        theme="monokai"
      />
    </div>
  );
};

export default DataSourceViewer;
