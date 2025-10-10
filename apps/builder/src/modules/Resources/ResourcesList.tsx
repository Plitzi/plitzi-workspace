import classNames from 'classnames';
import { use, useCallback } from 'react';

import PluginsContext from '@plitzi/sdk-plugins/PluginsContext';

import Resource from './Resource';

import type { Resource as TResource } from './types';

export type ResourcesListProps = {
  className?: string;
  items: TResource[];
  onRemove?: (item: TResource) => void;
};

const ResourcesList = ({ className, items, onRemove }: ResourcesListProps) => {
  const { plugins, remove } = use(PluginsContext);

  const handleResourceRemoved = useCallback(
    (id: string) => {
      const resource = items.find(item => item.id === id);
      if (!resource) {
        return;
      }

      if (resource.type === 'plugin') {
        const plugin = Object.values(plugins).find(plugin => plugin.type === resource.metadata.root && plugin.isMain);
        if (plugin) {
          void remove?.(plugin.type);
        }
      }

      onRemove?.(resource);
    },
    [items, onRemove, plugins, remove]
  );

  return (
    <div className={classNames('grid grid-cols-2 gap-2 overflow-y-auto pb-1', className)}>
      {items.map(resource => (
        <Resource
          className={classNames({ 'col-span-2': resource.type === 'plugin' })}
          key={resource.id}
          id={resource.id}
          cdnIdentifier={resource.cdnIdentifier}
          type={resource.type}
          title={resource.name}
          src={resource.path}
          metadata={resource.type === 'plugin' ? resource.metadata : undefined}
          onRemove={handleResourceRemoved}
        />
      ))}
    </div>
  );
};

export default ResourcesList;
