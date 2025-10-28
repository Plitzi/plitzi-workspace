import classNames from 'classnames';
import { use, useCallback } from 'react';

import useDragElement from '@pmodules/Elements/hooks/useDragElement';
import { ResourcesListContext } from '@pmodules/Resources/components/ResourcesList/ResourcesListProvider';

import ResourceUploadStatus from '../../../ResourceManager/ResourceUploadStatus';
import ResourceRemoveButton from '../../ResourceRemoveButton';

import type { DragEvent, MouseEvent } from 'react';

export type ResourceVideoProps = {
  className?: string;
  id: string;
  src: string;
  title?: string;
  removing?: boolean;
  directoryName?: string;
  onClick?: () => void;
  onRemove?: (e: MouseEvent) => void;
};

const ResourceVideo = ({
  className,
  id,
  title,
  src,
  removing,
  directoryName = '',
  onClick,
  onRemove
}: ResourceVideoProps) => {
  const { onDragStart } = useDragElement({ type: 'video', attributes: { src } });
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
        'group relative flex min-h-20 cursor-grabbing overflow-hidden rounded-md border border-gray-300 select-none',
        className
      )}
      onClick={onClick}
    >
      <video draggable={false} src={src} muted className="h-auto w-full object-cover" title={title} />
      <ResourceRemoveButton onRemove={onRemove} />
      {removing && <ResourceUploadStatus processing={removing} />}
    </div>
  );
};

export default ResourceVideo;
