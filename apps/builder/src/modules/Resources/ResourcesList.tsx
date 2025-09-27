import classNames from 'classnames';
import { use, useCallback } from 'react';

import PluginsContext from '@plitzi/sdk-plugins/PluginsContext';

import Resource from './Resource';

import type { Resource as TResource } from './types';

export type ResourcesListProps = {
  items: TResource[];
  onRemove?: () => void;
};

const ResourcesList = ({ items, onRemove }: ResourcesListProps) => {
  const { plugins, remove } = use(PluginsContext);

  const handleResourceRemoved = useCallback(
    (resource: TResource) => () => {
      if (resource.type === 'plugin') {
        const plugin = Object.values(plugins).find(plugin => plugin.type === resource.metadata.root && plugin.isMain);
        if (plugin) {
          void remove?.(plugin.type);
        }
      }

      onRemove?.();
    },
    [onRemove, plugins, remove]
  );

  return (
    <div className="grid grid-cols-2 gap-2 overflow-y-auto pb-1">
      {items.map(resource => (
        <Resource
          className={classNames({ 'col-span-2': resource.type === 'plugin' })}
          key={resource.id}
          id={resource.id}
          type={resource.type}
          title={resource.name}
          src={resource.path}
          metadata={resource.type === 'plugin' ? resource.metadata : undefined}
          onRemove={handleResourceRemoved(resource)}
        />
      ))}
    </div>
  );
};

export default ResourcesList;
