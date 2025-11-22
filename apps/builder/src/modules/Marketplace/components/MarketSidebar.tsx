import Button from '@plitzi/plitzi-ui/Button';
import Heading from '@plitzi/plitzi-ui/Heading';
import clsx from 'clsx';
import { useCallback, useState } from 'react';

import MarketSidebarItem from './MarketSidebarItem';

export type MarketSidebarProps = {
  className?: string;
  onSelect?: (option: string) => void;
};

const MarketSidebar = ({ className = '', onSelect }: MarketSidebarProps) => {
  const [selected, setSelected] = useState('news');

  const handleClick = useCallback(
    (option: string) => {
      setSelected(option);
      onSelect?.(option);
    },
    [onSelect]
  );

  return (
    <div className={clsx('flex flex-col justify-between', className)}>
      <div className="flex flex-col">
        <Heading as="h3" className="mb-8">
          Explore
        </Heading>
        <ul className="flex flex-col items-start">
          <MarketSidebarItem id="news" isSelected={selected === 'news'} onClick={handleClick}>
            <i className="fa-solid fa-bolt mr-2 flex w-5 items-center justify-center text-yellow-500" />
            New in
          </MarketSidebarItem>
          <MarketSidebarItem id="plugins" isSelected={selected === 'plugins'} onClick={handleClick}>
            <i className="fa-solid fa-puzzle-piece mr-2 flex w-5 items-center justify-center" />
            Plugins
          </MarketSidebarItem>
          <MarketSidebarItem id="templates" isSelected={selected === 'templates'} onClick={handleClick}>
            <i className="fa-solid fa-map mr-2 flex w-5 items-center justify-center" />
            Templates
          </MarketSidebarItem>
        </ul>
      </div>
      <Button intent="custom">
        <i className="fa-solid fa-comment mr-2 flex w-5 items-center justify-center" />
        Help Center
      </Button>
    </div>
  );
};

export default MarketSidebar;
