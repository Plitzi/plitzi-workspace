import Alert from '@plitzi/plitzi-ui/Alert';
import ContainerCollapsable from '@plitzi/plitzi-ui/ContainerCollapsable';
import Icon from '@plitzi/plitzi-ui/Icon';
import classNames from 'classnames';
import { use, useCallback } from 'react';

import PluginsContext from '@plitzi/sdk-plugins/PluginsContext';

import Resource from '../Resource';

import type { Resource as TResource } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

export type ResourcesDirectoryProps = {
  className?: string;
  name?: string;
  items: TResource[];
  defaultDirectory?: boolean;
  onRemove?: (item: TResource) => void;
  onRemoveDirectory?: (name?: string) => void;
};

const ResourceDirectory = ({
  className,
  name,
  items,
  defaultDirectory = false,
  onRemove,
  onRemoveDirectory
}: ResourcesDirectoryProps) => {
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

  const handleClickRemoveDirectory = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      onRemoveDirectory?.(name);
    },
    [name, onRemoveDirectory]
  );

  return (
    <ContainerCollapsable
      className={classNames(
        'w-full gap-2 rounded p-2',
        {
          'border border-dashed border-orange-500 bg-orange-100': items.length === 0,
          'bg-slate-100': items.length > 0
        },
        className
      )}
      collapsed={items.length !== 0}
    >
      <ContainerCollapsable.Header
        className={{ header: 'group', headerSlot: 'flex items-center gap-2' }}
        title={
          <div className="flex items-center gap-2">
            <Icon size="sm" icon="fa-solid fa-folder-open" />
            {name}
          </div>
        }
        placement="right"
        iconCollapsed={<Icon icon="fa-solid fa-angle-down" />}
        iconExpanded={<Icon icon="fa-solid fa-angle-up" />}
      >
        <div className="rounded border border-gray-500 px-1 text-xs text-gray-500">{items.length}</div>
        {!defaultDirectory && (
          <>
            <Icon icon="fa-solid fa-pencil" className="hidden cursor-pointer group-hover:block" title="Update" />
            <Icon
              intent="danger"
              icon="fas fa-trash-alt"
              className="hidden cursor-pointer group-hover:block"
              title="Remove"
              onClick={handleClickRemoveDirectory}
            />
          </>
        )}
      </ContainerCollapsable.Header>
      <ContainerCollapsable.Content>
        {items.length > 0 && (
          <div className="mt-2 block columns-3 gap-2">
            {items.map(resource => (
              <Resource
                className="mb-2"
                // className={classNames({ 'col-span-2': resource.type === 'plugin' || resource.type === 'template' })}
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
        )}
        {items.length === 0 && (
          <Alert intent="warning" size="xs" solid={false}>
            <span className="text-xs leading-3">
              No resources in this directory. Drag and drop resources here or this folder will be removed automatically
            </span>
          </Alert>
        )}
      </ContainerCollapsable.Content>
    </ContainerCollapsable>
  );
};

export default ResourceDirectory;
