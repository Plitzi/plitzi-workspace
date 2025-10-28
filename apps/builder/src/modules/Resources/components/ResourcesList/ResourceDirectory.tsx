import Alert from '@plitzi/plitzi-ui/Alert';
import ContainerCollapsable from '@plitzi/plitzi-ui/ContainerCollapsable';
import Icon from '@plitzi/plitzi-ui/Icon';
import classNames from 'classnames';
import { use, useCallback, useMemo, useState } from 'react';

import PluginsContext from '@plitzi/sdk-plugins/PluginsContext';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';

import Resource from '../Resource';
import { formatFolderName } from './ListHelper';
import { ResourcesListContext } from './ResourcesListProvider';

import type { BuilderNetworkContextValue, Resource as TResource } from '@plitzi/sdk-shared';
import type { MutationsMap } from '@pmodules/Network/Mutations';
import type { QueriesMap } from '@pmodules/Network/Queries';
import type { DragEvent, MouseEvent } from 'react';

export type ResourcesDirectoryProps = {
  className?: string;
  name?: string;
  items: TResource[];
  defaultDirectory?: boolean;
  canDrop?: boolean;
  cdnIdentifier: string;
  onRemove?: (item: TResource) => void;
  onRemoveDirectory?: (name?: string) => void;
};

const ResourceDirectory = ({
  className,
  name,
  items,
  defaultDirectory = false,
  canDrop = true,
  cdnIdentifier,
  onRemove,
  onRemoveDirectory
}: ResourcesDirectoryProps) => {
  const { mutate } = use(NetworkContext) as BuilderNetworkContextValue<QueriesMap, MutationsMap>;
  const [isDragging, setIsDragging] = useState(false);
  const { plugins, remove } = use(PluginsContext);
  const { draggingFile } = use(ResourcesListContext);
  const nameFormatted = useMemo(() => formatFolderName(name), [name]);

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

  const handleFolderDragOver = useCallback(
    (e: DragEvent<HTMLElement>) => {
      e.preventDefault();
      if (!canDrop || isDragging || draggingFile?.directoryName === name) {
        return;
      }

      setIsDragging(true);
    },
    [canDrop, draggingFile?.directoryName, isDragging, name]
  );

  const handleFolderDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault();
      if (!canDrop || !draggingFile || draggingFile.directoryName === name) {
        return;
      }

      setIsDragging(false);
      // Handle dropped files here
      console.log('DROPPED HERE', draggingFile);

      const response = await mutate(
        'SpaceMoveResource',
        { cdnIdentifier, identifier: draggingFile.id, prefix: 'test_abc' },
        false,
        false,
        { customFetch: true }
      );
      console.log(response);
    },
    [canDrop, cdnIdentifier, draggingFile, mutate, name]
  );

  const handleFolderDragLeave = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      if (!canDrop || draggingFile?.directoryName === name) {
        return;
      }

      setIsDragging(false);
    },
    [canDrop, draggingFile?.directoryName, name]
  );

  return (
    <ContainerCollapsable
      className={classNames(
        'w-full gap-2 rounded p-2',
        {
          'border border-dashed border-orange-500 bg-orange-100': items.length === 0,
          'bg-slate-100': items.length > 0,
          'outline-2 -outline-offset-2 outline-black': isDragging
        },
        className
      )}
      onDragOver={handleFolderDragOver}
      onDragLeave={handleFolderDragLeave}
      onDrop={handleFolderDrop}
    >
      <ContainerCollapsable.Header
        className={{
          header: classNames('group w-full', { 'pointer-events-none': isDragging }),
          headerSlot: 'flex items-center gap-2',
          headerContainer: 'grow basis-0 overflow-hidden',
          headerTitle: 'w-full grow basis-0'
        }}
        title={
          <div className="flex w-full items-center gap-2">
            <Icon size="sm" icon="fa-solid fa-folder-open" />
            <div className="truncate">{nameFormatted}</div>
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
      <ContainerCollapsable.Content
        className={classNames('max-h-[350px] overflow-y-auto', { 'pointer-events-none': isDragging })}
      >
        {items.length > 0 && (
          <div className="mt-2 block columns-3 gap-2">
            {items.map(resource => (
              <Resource
                className="mb-2"
                key={resource.id}
                id={resource.id}
                cdnIdentifier={resource.cdnIdentifier}
                type={resource.type}
                title={resource.name}
                src={resource.path}
                metadata={resource.type === 'plugin' ? resource.metadata : undefined}
                directoryName={name}
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
