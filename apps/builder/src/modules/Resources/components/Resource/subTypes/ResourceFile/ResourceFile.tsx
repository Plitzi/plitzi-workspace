import clsx from 'clsx';
import { use, useCallback, useState } from 'react';

import { ResourcesListContext } from '@pmodules/Resources/components/ResourcesList/ResourcesListProvider';

import ResourceLoading from '../../ResourceLoading';
import ResourceName from '../../ResourceName';
import ResourceRemoveButton from '../../ResourceRemoveButton';

import type { ResourceType } from '@plitzi/sdk-shared';
import type { DragEvent, MouseEvent } from 'react';

export type ResourceFileProps = {
  className?: string;
  id: string;
  title?: string;
  type: ResourceType;
  directoryName?: string;
  removing?: boolean;
  isLoading?: boolean;
  onClick?: () => void;
  onRemove?: (e: MouseEvent) => void;
};

const ResourceFile = ({
  className,
  id,
  title,
  type,
  directoryName = '',
  removing = false,
  isLoading = false,
  onClick,
  onRemove
}: ResourceFileProps) => {
  const { setDraggingFile } = use(ResourcesListContext);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = useCallback(
    (e: DragEvent) => {
      e.stopPropagation();
      setDraggingFile({ id, type, directoryName });
    },
    [directoryName, id, setDraggingFile, type]
  );

  const handleDragEnd = useCallback(() => setIsDragging(false), []);

  return (
    <div
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      draggable={!isLoading}
      className={clsx(
        'group relative flex w-full cursor-pointer flex-col justify-center overflow-hidden rounded-md border border-gray-300 select-none',
        className
      )}
      onClick={onClick}
    >
      <div className="flex aspect-video h-full w-full grow items-center justify-center">
        <i className="fa-solid fa-file fa-2x text-gray-300" title="Unknown" />
      </div>
      {!isDragging && <ResourceRemoveButton onRemove={onRemove} />}
      {(isLoading || removing) && <ResourceLoading />}
      {title && <ResourceName name={title} fullWidth />}
    </div>
  );
};

export default ResourceFile;
