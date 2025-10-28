import classNames from 'classnames';
import { use, useCallback } from 'react';

import useDragElement from '@pmodules/Elements/hooks/useDragElement';
import { ResourcesListContext } from '@pmodules/Resources/components/ResourcesList/ResourcesListProvider';

import ResourceUploadStatus from '../../../ResourceManager/ResourceUploadStatus';

import type { DragEvent, MouseEvent } from 'react';

export type ResourceImageProps = {
  className?: string;
  id: string;
  cdnIdentifier: string;
  src: string;
  title?: string;
  removing?: boolean;
  directoryName?: string;
  onClick?: () => void;
  onRemove?: (e: MouseEvent) => void;
};

const ResourceImage = ({
  className,
  id,
  title,
  src,
  removing,
  directoryName = '',
  onClick,
  onRemove
}: ResourceImageProps) => {
  const { onDragStart } = useDragElement({ type: 'image', attributes: { src } });
  const { setDraggingFile } = use(ResourcesListContext);

  const handleDragStart = useCallback(
    (e: DragEvent) => {
      onDragStart(e);
      setDraggingFile({ id, type: 'image', directoryName });
    },
    [directoryName, id, onDragStart, setDraggingFile]
  );

  return (
    <div
      onDragStart={handleDragStart}
      draggable
      className={classNames(
        'group relative flex w-full cursor-grabbing overflow-hidden rounded-md border border-gray-300 select-none',
        className
      )}
      onClick={onClick}
    >
      <img draggable={false} src={src} alt={title} className="h-auto w-full object-cover" title={title} />
      <div className="absolute top-1/2 left-1/2 hidden aspect-square -translate-1/2 cursor-pointer items-center justify-center rounded-full bg-white px-1 group-hover:flex">
        <i className="fa-solid fa-circle-xmark hover:text-red-400" title="Remove" onClick={onRemove} />
      </div>
      {removing && <ResourceUploadStatus processing={removing} />}
    </div>
  );
};

export default ResourceImage;
