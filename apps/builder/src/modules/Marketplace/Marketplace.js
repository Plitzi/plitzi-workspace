// Packages
import React, { useState } from 'react';

// Relatives
import MarketSidebar from './components/MarketSidebar';
import MarketPlugins from './components/MarketPlugins';
import MarketTemplates from './components/MarketTemplates/MarketTemplates';
import MarketNews from './components/MarketNews/MarketNews';

/** @returns {React.ReactElement} */
const Marketplace = () => {
  const [selected, setSelected] = useState('news');

  return (
    <div className="flex flex-col grow basis-0 px-6 pt-6">
      <div className="flex mb-8">
        <div className="flex select-none items-center justify-center">
          <div
            className="h-10 w-10 bg-no-repeat bg-contain mr-4"
            style={{ backgroundImage: 'url(https://cdn.plitzi.com/resources/img/favicon.svg)' }}
          />
          <div className="text-3xl flex flex-col">
            Plitzi<span className="text-xs text-blue-500 font-bold">Marketplace</span>
          </div>
        </div>
      </div>
      <div className="flex grow basis-0">
        <MarketSidebar onSelect={setSelected} className="pr-10 pb-6 mr-10 border-r border-gray-300" />
        <div className="flex flex-col grow basis-0">
          {selected === 'news' && <MarketNews />}
          {selected === 'plugins' && <MarketPlugins />}
          {selected === 'templates' && <MarketTemplates />}
        </div>
      </div>
    </div>
  );
};

export default Marketplace;
