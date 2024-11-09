// Packages
import React, { useCallback } from 'react';
import noop from 'lodash/noop.js';
import classNames from 'classnames';

// Relatives
import { ORIENTATION_HORIZONTAL, ORIENTATION_VERTICAL } from './DevToolsPanel.js';

/**
 * @param {{
 *   className?: string;
 *   children: React.ReactNode;
 *   tabSelected?: string;
 *   orientation: 'vertical' | 'horizontal';
 *   onChangeOrientation: (orientation: 'horizontal' | 'vertical') => void;
 *   onTabSelect?: (tabIndex: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const DevToolsHeader = props => {
  const { tabSelected = 0, orientation = ORIENTATION_VERTICAL, onChangeOrientation = noop, onTabSelect = noop } = props;

  const handleClickOrientation = useCallback(() => {
    if (orientation === ORIENTATION_HORIZONTAL) {
      onChangeOrientation(ORIENTATION_VERTICAL);
    } else {
      onChangeOrientation(ORIENTATION_HORIZONTAL);
    }
  }, [orientation, onChangeOrientation]);

  const handleClickTab = useCallback(tabIndex => () => onTabSelect(tabIndex), [onTabSelect]);

  return (
    <div className="flex justify-between grow border-b border-b-gray-300 bg-gray-200 select-none">
      <div className="flex">
        <div
          className={classNames('px-2 py-1 border-b-4 cursor-pointer hover:text-inherit hover:bg-gray-100', {
            'text-purple-500 border-purple-500': tabSelected === 'logs',
            'border-transparent': tabSelected !== 'logs'
          })}
          onClick={handleClickTab('logs')}
        >
          Logs
        </div>
        <div
          className={classNames('px-2 py-1 border-b-4 cursor-pointer hover:text-inherit hover:bg-gray-100', {
            'text-purple-500 border-purple-500': tabSelected === 'dataSources',
            'border-transparent': tabSelected !== 'dataSources'
          })}
          onClick={handleClickTab('dataSources')}
        >
          Data Sources
        </div>
        <div
          className={classNames('px-2 py-1 border-b-4 cursor-pointer hover:text-inherit hover:bg-gray-100', {
            'text-purple-500 border-purple-500': tabSelected === 'elements',
            'border-transparent': tabSelected !== 'elements'
          })}
          onClick={handleClickTab('elements')}
        >
          Elements
        </div>
        <div
          className={classNames('px-2 py-1 border-b-4 cursor-pointer hover:text-inherit hover:bg-gray-100', {
            'text-purple-500 border-purple-500': tabSelected === 'variables',
            'border-transparent': tabSelected !== 'variables'
          })}
          onClick={handleClickTab('variables')}
        >
          Variables
        </div>
        <div
          className={classNames('px-2 py-1 border-b-4 cursor-pointer hover:text-inherit hover:bg-gray-100', {
            'text-purple-500 border-purple-500': tabSelected === 'plugins',
            'border-transparent': tabSelected !== 'plugins'
          })}
          onClick={handleClickTab('plugins')}
        >
          Plugins
        </div>
      </div>
      <div className="flex px-2">
        <button onClick={handleClickOrientation}>Orientation</button>
      </div>
    </div>
  );
};

export default DevToolsHeader;
