import classNames from 'classnames';
import { useCallback } from 'react';

import type { Orientation } from '../../DevToolsContainer';

export type DevToolsHeaderProps = {
  className?: string;
  tabSelected?: string;
  orientation: Orientation;
  onChangeOrientation?: (orientation: Orientation) => void;
  onTabSelect?: (tabIndex: string) => void;
};

const DevToolsHeader = ({
  tabSelected,
  orientation = 'vertical',
  onChangeOrientation,
  onTabSelect
}: DevToolsHeaderProps) => {
  const handleClickOrientation = useCallback(() => {
    onChangeOrientation?.(orientation === 'horizontal' ? 'vertical' : 'horizontal');
  }, [orientation, onChangeOrientation]);

  const handleClickTab = useCallback((tabIndex: string) => () => onTabSelect?.(tabIndex), [onTabSelect]);

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
