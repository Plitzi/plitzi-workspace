// Packages
import React, { useCallback, useState } from 'react';
import classNames from 'classnames';
import Heading from '@plitzi/plitzi-ui-components/Heading';
import noop from 'lodash/noop';
import Button from '@plitzi/plitzi-ui-components/Button';

// Relatives
import MarketSidebarItem from './MarketSidebarItem';

/**
 * @param {{
 *   className?: string;
 *   onSelect?: (option: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const MarketSidebar = props => {
  const { className = '', onSelect = noop } = props;
  const [selected, setSelected] = useState('news');

  const handleClick = useCallback(
    option => {
      setSelected(option);
      onSelect(option);
    },
    [onSelect]
  );

  return (
    <div className={classNames('flex flex-col justify-between', className)}>
      <div className="flex flex-col">
        <Heading type="h3" className="mb-8">
          Explore
        </Heading>
        <ul className="flex flex-col items-start">
          <MarketSidebarItem id="news" isSelected={selected === 'news'} onClick={handleClick}>
            <i className="fa-solid fa-bolt text-yellow-500 mr-2 w-5 flex items-center justify-center" />
            New in
          </MarketSidebarItem>
          <MarketSidebarItem id="plugins" isSelected={selected === 'plugins'} onClick={handleClick}>
            <i className="fa-solid fa-puzzle-piece mr-2 w-5 flex items-center justify-center" />
            Plugins
          </MarketSidebarItem>
          <MarketSidebarItem id="templates" isSelected={selected === 'templates'} onClick={handleClick}>
            <i className="fa-solid fa-map mr-2 w-5 flex items-center justify-center" />
            Templates
          </MarketSidebarItem>
        </ul>
      </div>
      <Button intent="custom">
        <i className="fa-solid fa-comment mr-2 w-5 flex items-center justify-center" />
        Help Center
      </Button>
    </div>
  );
};

export default MarketSidebar;
