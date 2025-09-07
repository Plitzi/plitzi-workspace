import PluginItem from './PluginItem';

import type { MarketPlacePluginRaw } from '@pmodules/Marketplace/types';

export type PluginListProps = {
  plugins?: MarketPlacePluginRaw[];
  onClick?: (plugin: string) => void;
};

const PluginList = ({ plugins, onClick }: PluginListProps) => (
  <div className="mt-8 grid grid-cols-4 gap-4">
    {plugins?.map((plugin, i) => {
      const {
        name,
        description,
        type,
        market: { icon, website, backgroundColor },
        latestVersion,
        version
      } = plugin;

      return (
        <PluginItem
          key={i}
          name={name}
          description={description}
          latestVersion={latestVersion?.version}
          type={type}
          icon={icon}
          website={website}
          color={backgroundColor}
          version={version}
          onClick={onClick}
        />
      );
    })}
  </div>
);

export default PluginList;
