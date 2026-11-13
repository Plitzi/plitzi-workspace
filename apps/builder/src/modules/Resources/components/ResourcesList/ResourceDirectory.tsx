import ContainerCollapsable from '@plitzi/plitzi-ui/ContainerCollapsable';
import Icon from '@plitzi/plitzi-ui/Icon';
import { useToast } from '@plitzi/plitzi-ui/Toast';
import clsx from 'clsx';
import { use, useCallback, useMemo, useState } from 'react';

import { PluginsContext } from '@plitzi/sdk-shared/plugins/react';
import Notice from '@pmodules/App/components/Notice';
import useBuilderNetwork from '@pmodules/Network/hooks/useBuilderNetwork';

import { mainPluginOf } from '../../helpers';
import Resource from '../Resource';
import { ResourcesListContext } from './ResourcesListProvider';

import type { Resource as TResource } from '@plitzi/sdk-shared';
import type { DragEvent, MouseEvent } from 'react';

export type ResourcesDirectoryProps = {
  className?: string;
  name?: string;
  items: TResource[];
  isDefault?: boolean;
  canDrop?: boolean;
  canRemove?: boolean;
  cdnIdentifier: string;
  bucketIdentifier: string;
  onChange?: () => void;
  onRemove?: (item: TResource) => void;
  onRemoveDirectory?: (name?: string) => void;
};

const ResourceDirectory = ({
  className,
  name,
  items,
  isDefault = false,
  canRemove = true,
  canDrop = true,
  cdnIdentifier,
  bucketIdentifier,
  onChange,
  onRemove,
  onRemoveDirectory
}: ResourcesDirectoryProps) => {
  const { mutate } = useBuilderNetwork();
  const { addToast } = useToast();
  const [isDragging, setIsDragging] = useState(false);
  const { plugins, remove } = use(PluginsContext);
  const { draggingFile, isFileMoving, setIsFileMoving } = use(ResourcesListContext);
  const nameFormatted = useMemo(() => name?.replace(/[_-]+/g, ' '), [name]);

  const handleResourceRemoved = useCallback(
    (id: string) => {
      const resource = items.find(item => item.id === id);
      if (!resource) {
        return;
      }

      if (resource.type === 'plugin') {
        const plugin = mainPluginOf(plugins, resource.metadata.root);
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
      setIsFileMoving(true);
      try {
        await mutate(
          'SpaceMoveResource',
          { cdnIdentifier, bucketIdentifier, identifier: draggingFile.id, prefix: isDefault ? '' : name },
          false,
          false,
          { customFetch: true }
        );
        onChange?.();

        setIsFileMoving(false);
      } catch (e: unknown) {
        addToast((e as Error).message, { appeareance: 'warning', autoDismiss: true, placement: 'top-right' });
      } finally {
        setIsFileMoving(false);
      }
    },
    [
      canDrop,
      draggingFile,
      name,
      setIsFileMoving,
      mutate,
      cdnIdentifier,
      bucketIdentifier,
      isDefault,
      onChange,
      addToast
    ]
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

  const empty = !isDefault && items.length === 0;

  return (
    // A row of the panel's list, as a folder of Pages is: no card of its own, its count in words' colour. A folder a file
    // is dragged over takes the accent; an empty one says so, in amber, until something is dropped in it.
    <ContainerCollapsable
      className={clsx(
        'w-full rounded-sm',
        { 'bg-primary-50 ring-primary-400/60 dark:bg-primary-400/15 ring-1 ring-inset': isDragging },
        className
      )}
      collapsed
      onDragOver={handleFolderDragOver}
      onDragLeave={handleFolderDragLeave}
      onDrop={handleFolderDrop}
    >
      <ContainerCollapsable.Header
        className={{
          header: clsx('group hover:bg-ui-hover h-7 w-full rounded-sm px-1.5', { 'pointer-events-none': isDragging }),
          headerSlot: 'flex items-center gap-2',
          headerContainer: 'grow basis-0 overflow-hidden',
          headerTitle: 'w-full grow basis-0'
        }}
        title={
          <div className="text-ui-fg flex w-full items-center gap-2 text-[13px]">
            <Icon size="sm" icon="fa-solid fa-folder" className="text-ui-fg-subtle" />
            <div className="truncate">{nameFormatted}</div>
            {empty && (
              <span className="shrink-0 rounded-sm bg-amber-500/10 px-1 text-[10px] leading-4 font-medium text-amber-700 dark:text-amber-300">
                empty
              </span>
            )}
          </div>
        }
        placement="right"
        iconCollapsed={<Icon size="sm" icon="fa-solid fa-angle-right" />}
        iconExpanded={<Icon size="sm" icon="fa-solid fa-angle-down" />}
      >
        {!isDefault && canRemove && (
          <Icon
            intent="danger"
            icon="fas fa-trash-alt"
            size="xs"
            className="hidden cursor-pointer group-hover:block"
            title="Remove"
            onClick={handleClickRemoveDirectory}
          />
        )}
        <span className="text-ui-fg-subtle text-[11px] tabular-nums">{items.length}</span>
      </ContainerCollapsable.Header>
      <ContainerCollapsable.Content
        className={clsx('max-h-87.5 overflow-y-auto px-1.5 pb-2', { 'pointer-events-none': isDragging })}
      >
        {items.length > 0 && (
          <div className="mt-1 block columns-3 gap-2">
            {items.map(resource => (
              <Resource
                className="mb-2"
                key={resource.id}
                id={resource.id}
                cdnIdentifier={resource.cdnIdentifier}
                bucketIdentifier={resource.bucketIdentifier}
                type={resource.type}
                title={resource.name}
                src={resource.path}
                metadata={resource.type === 'plugin' ? resource.metadata : undefined}
                usedBy={resource.usedBy}
                directoryName={name}
                isLoading={draggingFile?.id === resource.id && isFileMoving}
                onRemove={handleResourceRemoved}
              />
            ))}
          </div>
        )}
        {!isDefault && items.length === 0 && (
          <Notice tone="caution">
            <span className="text-xs leading-3">
              No resources in this directory. Drag and drop resources here or this folder will be removed automatically
            </span>
          </Notice>
        )}
      </ContainerCollapsable.Content>
    </ContainerCollapsable>
  );
};

export default ResourceDirectory;
