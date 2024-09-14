// Packages
import React, { useCallback, useEffect, useMemo, useState, use } from 'react';
import throttle from 'lodash/throttle';
import ReactJson from '@microlink/react-json-view';
import classNames from 'classnames';

// Monorepo
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';

// Relatives
import DevToolsContext from '../../DevToolsContext';
import DataSourceViewerButton from './DataSourceViewerButton';

/**
 * @param {{
 *   className?: string;
 *   content?: string;
 * }} props
 * @returns {React.ReactElement}
 */
const DataSourceViewer = props => {
  const { className } = props;
  const { getData } = use(DevToolsContext);
  const [selectorEnabled, setSelectorEnabled] = useState(false);
  const { currentPageId } = use(NavigationContext);
  const [id, setId] = useState();
  const dataSource = useMemo(() => {
    if (!id || !getData) {
      return {};
    }

    return getData(`getElementDataSource-${id}`);
  }, [getData, id]);

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

  const handleClick = useCallback(e => {
    const closest = e.target.closest('.plitzi-sdk');
    if (!closest) {
      return;
    }

    e.stopPropagation();
    e.preventDefault();
    setSelectorEnabled(false);
  }, []);

  const handleClickSelectorIcon = useCallback(() => setSelectorEnabled(true), [setSelectorEnabled]);

  const handleClickClearIcon = useCallback(() => {
    setSelectorEnabled(false);
    setId();
  }, [setId]);

  const handleClickPage = useCallback(() => {
    setSelectorEnabled(false);
    setId(currentPageId);
  }, [currentPageId]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    const elementDOM = document.querySelector(`[data-id="${id}"]`);
    elementDOM?.classList.add('devtools-element-hovered');

    return () => {
      elementDOM?.classList.remove('devtools-element-hovered');
    };
  }, [id]);

  useEffect(() => {
    if (!selectorEnabled || typeof document === 'undefined') {
      return undefined;
    }

    const plitziSdkContainer = document.getElementsByClassName('plitzi-sdk')[0];
    if (!plitziSdkContainer) {
      return undefined;
    }

    plitziSdkContainer.addEventListener('click', handleClick);
    plitziSdkContainer.addEventListener('mousemove', handleMouseMove);

    return () => {
      plitziSdkContainer.removeEventListener('click', handleClick);
      plitziSdkContainer.removeEventListener('mousemove', handleMouseMove);
    };
  }, [handleClick, handleMouseMove, selectorEnabled]);

  return (
    <div className={classNames('flex flex-col h-full w-full', className)}>
      <div className="flex border-b border-gray-300 px-2 py-1 gap-2 items-center justify-between">
        <div className="flex gap-2">
          <DataSourceViewerButton
            iconClassName="fa-regular fa-hand-pointer"
            title="Select an element in the page to inspect it"
            onClick={handleClickSelectorIcon}
            isSelected={selectorEnabled}
          />
          <DataSourceViewerButton iconClassName="fa-regular fa-file" title="Current Page" onClick={handleClickPage} />
        </div>
        <DataSourceViewerButton iconClassName="fa-solid fa-ban" onClick={handleClickClearIcon} title="Clear" />
      </div>
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
