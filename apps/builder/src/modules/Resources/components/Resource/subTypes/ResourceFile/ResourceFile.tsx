import classNames from 'classnames';
import { use, useCallback } from 'react';

import { ResourcesListContext } from '@pmodules/Resources/components/ResourcesList/ResourcesListProvider';

import ResourceLoading from '../../ResourceLoading';
import ResourceName from '../../ResourceName';
import ResourceRemoveButton from '../../ResourceRemoveButton';

import type { ResourceType } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

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

  const handleDragStart = useCallback(() => {
    setDraggingFile({ id, type, directoryName });
  }, [directoryName, id, setDraggingFile, type]);

  return (
    <div
      onDragStart={handleDragStart}
      draggable={!isLoading}
      className={classNames(
        'group relative flex w-full cursor-pointer flex-col justify-center overflow-hidden rounded-md border border-gray-300 select-none',
        className
      )}
      onClick={onClick}
    >
      <div className="flex aspect-video h-full w-full grow items-center justify-center">
        <i className="fa-solid fa-file fa-2x text-gray-300" title="Unknown" />
      </div>
      <ResourceRemoveButton onRemove={onRemove} />
      {(isLoading || removing) && <ResourceLoading />}
      {title && <ResourceName name={title} fullWidth />}
    </div>
  );
};

export default ResourceFile;
