// Packages
import React, { useCallback, useEffect, useMemo, useState, use } from 'react';
import throttle from 'lodash/throttle';
import ReactJson from '@microlink/react-json-view';
import classNames from 'classnames';

// Monorepo
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';

// Relatives
import DevToolsContext from '../../DevToolsContext';

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
          <i
            className={classNames(
              'fa-regular w-6 h-6 flex items-center justify-center fa-hand-pointer border border-dotted p-0.5 cursor-pointer',
              {
                'border-gray-500 hover:text-purple-500 hover:border-purple-500': !selectorEnabled,
                'text-purple-500 border-purple-500': selectorEnabled
              }
            )}
            title="Select an element in the page to inspect it"
            onClick={handleClickSelectorIcon}
          />
          <i
            className="fa-regular fa-file w-6 h-6 flex items-center justify-center border border-dotted p-0.5 cursor-pointer hover:text-purple-500 hover:border-purple-500"
            title="Current Page"
            onClick={handleClickPage}
          />
        </div>
        <i
          className="fa-solid fa-ban w-6 h-6 flex items-center justify-center border border-dotted p-0.5 cursor-pointer hover:text-purple-500 hover:border-purple-500"
          onClick={handleClickClearIcon}
          title="Clear"
        />
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
