import Breadcrumb from '@plitzi/plitzi-ui/Breadcrumb';
import { useCallback } from 'react';

import DetailsContent from './DetailsContent';
import DetailsSidebar from './DetailsSidebar';

import type { MarketPlacePlugin } from '@pmodules/Marketplace/types';
import type { Dispatch, SetStateAction } from 'react';

export type PluginDetailsProps = {
  name?: string;
  description?: string;
  type?: string;
  latestVersion: string;
  version: string;
  revisions: { version: string }[];
  icon?: string;
  color?: string;
  owner?: string;
  website?: string;
  createdAt?: number;
  setPluginSelected?: Dispatch<SetStateAction<MarketPlacePlugin | undefined>>;
  onAdd?: (version: string) => void;
  onUpdate?: (version: string) => Promise<boolean>;
  onRemove?: () => void;
};

const PluginDetails = ({
  name = 'Plugin Name',
  description = 'Plugin Description',
  icon = '',
  color = '',
  owner = 'Plitzi',
  website = 'https://plitzi.com',
  revisions,
  version,
  latestVersion,
  createdAt = 0,
  setPluginSelected,
  onAdd,
  onUpdate,
  onRemove
}: PluginDetailsProps) => {
  const handleClickBack = useCallback(() => {
    setPluginSelected?.(undefined);
  }, [setPluginSelected]);

  return (
    <div className="flex grow basis-0 flex-col">
      <Breadcrumb separator="/" className="rounded-sm bg-blue-100 px-6 py-4">
        <span className="cursor-pointer font-bold" onClick={handleClickBack}>
          Plugins
        </span>
        {name}
      </Breadcrumb>
      <div className="mt-10 mb-6 flex grow basis-0 overflow-auto px-4">
        <DetailsContent />
        <DetailsSidebar
          name={name}
          description={description}
          icon={icon}
          color={color}
          owner={owner}
          website={website}
          createdAt={createdAt}
          version={version}
          latestVersion={latestVersion}
          revisions={revisions}
          onAdd={onAdd}
          onUpdate={onUpdate}
          onRemove={onRemove}
        />
      </div>
    </div>
  );
};

export default PluginDetails;
