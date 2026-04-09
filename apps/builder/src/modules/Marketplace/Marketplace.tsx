import { useState } from 'react';

import MarketNews from './components/MarketNews/MarketNews';
import MarketPlugins from './components/MarketPlugins';
import MarketSidebar from './components/MarketSidebar';
import MarketTemplates from './components/MarketTemplates/MarketTemplates';

const Marketplace = () => {
  const [selected, setSelected] = useState('news');

  return (
    <div className="flex grow basis-0 flex-col px-6 pt-6">
      <div className="mb-8 flex">
        <div className="flex items-center justify-center select-none">
          <div
            className="mr-4 h-10 w-10 bg-contain bg-no-repeat"
            style={{ backgroundImage: 'url(https://cdn.plitzi.com/resources/img/favicon.svg)' }}
          />
          <div className="flex flex-col text-3xl">
            Plitzi<span className="text-xs font-bold text-blue-500">Marketplace</span>
          </div>
        </div>
      </div>
      <div className="flex grow basis-0">
        <MarketSidebar onSelect={setSelected} className="mr-10 border-r border-gray-300 pr-10 pb-6 dark:border-zinc-700" />
        <div className="flex grow basis-0 flex-col">
          {selected === 'news' && <MarketNews />}
          {selected === 'plugins' && <MarketPlugins />}
          {selected === 'templates' && <MarketTemplates />}
        </div>
      </div>
    </div>
  );
};

export default Marketplace;
