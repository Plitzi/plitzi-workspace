import clsx from 'clsx';
import { use, useCallback, useState } from 'react';

import useDragElement from '@pmodules/Elements/hooks/useDragElement';
import { ResourcesListContext } from '@pmodules/Resources/components/ResourcesList/ResourcesListProvider';

import ResourceLoading from '../../ResourceLoading';
import ResourceRemoveButton from '../../ResourceRemoveButton';

import type { DragEvent, MouseEvent } from 'react';

export type ResourceMediaProps = {
  className?: string;
  id: string;
  type: 'image' | 'video';
  src: string;
  title?: string;
  removing?: boolean;
  directoryName?: string;
  isLoading?: boolean;
  onClick?: () => void;
  onRemove?: (e: MouseEvent) => void;
};

const ResourceMedia = ({
  className,
  id,
  type,
  title,
  src,
  removing = false,
  directoryName = '',
  isLoading = false,
  onClick,
  onRemove
}: ResourceMediaProps) => {
  const { onDragStart } = useDragElement({ type, attributes: { src } });
  const [isDragging, setIsDragging] = useState(false);
  const { setDraggingFile } = use(ResourcesListContext);

  const handleDragStart = useCallback(
    (e: DragEvent) => {
      onDragStart(e);
      setDraggingFile({ id, type, directoryName });
      setIsDragging(true);
    },
    [directoryName, id, onDragStart, setDraggingFile, type]
  );

  const handleDragEnd = useCallback(() => setIsDragging(false), []);

  return (
    <div
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      draggable={!isLoading}
      className={clsx(
        'group relative flex cursor-grabbing overflow-hidden rounded-md border border-gray-300 select-none dark:border-zinc-600',
        { 'w-full': type === 'image', 'min-h-20': type === 'video' },
        className
      )}
      onClick={onClick}
    >
      {type === 'image' && (
        <img draggable={false} src={src} alt={title} className="h-auto w-full object-cover" title={title} />
      )}
      {type === 'video' && (
        <video draggable={false} src={src} muted className="h-auto w-full object-cover" title={title} />
      )}
      {!isDragging && <ResourceRemoveButton onRemove={onRemove} />}
      {(isLoading || removing) && <ResourceLoading />}
    </div>
  );
};

export default ResourceMedia;
