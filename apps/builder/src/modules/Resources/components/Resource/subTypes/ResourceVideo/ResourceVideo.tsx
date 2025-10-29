import classNames from 'classnames';
import { use, useCallback, useState } from 'react';

import useDragElement from '@pmodules/Elements/hooks/useDragElement';
import { ResourcesListContext } from '@pmodules/Resources/components/ResourcesList/ResourcesListProvider';

import ResourceLoading from '../../ResourceLoading';
import ResourceRemoveButton from '../../ResourceRemoveButton';

import type { DragEvent, MouseEvent } from 'react';

export type ResourceVideoProps = {
  className?: string;
  id: string;
  src: string;
  title?: string;
  removing?: boolean;
  directoryName?: string;
  isLoading?: boolean;
  onClick?: () => void;
  onRemove?: (e: MouseEvent) => void;
};

const ResourceVideo = ({
  className,
  id,
  title,
  src,
  removing = false,
  directoryName = '',
  isLoading = false,
  onClick,
  onRemove
}: ResourceVideoProps) => {
  const { onDragStart } = useDragElement({ type: 'video', attributes: { src } });
  const [isDragging, setIsDragging] = useState(false);
  const { setDraggingFile } = use(ResourcesListContext);

  const handleDragStart = useCallback(
    (e: DragEvent) => {
      onDragStart(e);
      setDraggingFile({ id, type: 'image', directoryName });
    },
    [directoryName, id, onDragStart, setDraggingFile]
  );

  const handleDragEnd = useCallback(() => setIsDragging(false), []);

  return (
    <div
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      draggable={!isLoading}
      className={classNames(
        'group relative flex min-h-20 cursor-grabbing overflow-hidden rounded-md border border-gray-300 select-none',
        className
      )}
      onClick={onClick}
    >
      <video draggable={false} src={src} muted className="h-auto w-full object-cover" title={title} />
      {!isDragging && <ResourceRemoveButton onRemove={onRemove} />}
      {(isLoading || removing) && <ResourceLoading />}
    </div>
  );
};

export default ResourceVideo;
