import classNames from 'classnames';

import useDragElement from '@pmodules/Elements/hooks/useDragElement';

import ResourceName from '../../../ResourceManager/ResourceName';
import ResourceType from '../../../ResourceManager/ResourceType';
import ResourceUploadStatus from '../../../ResourceManager/ResourceUploadStatus';

import type { MouseEvent } from 'react';

export type ResourceVideoProps = {
  className?: string;
  id: string;
  cdnIdentifier: string;
  src: string;
  title?: string;
  removing?: boolean;
  onClick?: () => void;
  onRemove?: (e: MouseEvent) => void;
};

const ResourceVideo = ({ className, title, src, removing, onClick, onRemove }: ResourceVideoProps) => {
  const { onDragStart } = useDragElement({ type: 'video', attributes: { src } });

  return (
    <div
      onDragStart={onDragStart}
      draggable
      className={classNames(
        'group relative flex min-h-[80px] w-full cursor-grabbing overflow-hidden rounded-md border border-gray-300 select-none',
        className
      )}
      onClick={onClick}
    >
      <video draggable={false} src={src} muted className="aspect-video h-full w-full" />
      <div className="absolute top-1 right-1 hidden aspect-square cursor-pointer items-center justify-center rounded-full bg-white px-1 group-hover:flex">
        <i className="fa-solid fa-circle-xmark hover:text-red-400" title="Remove" onClick={onRemove} />
      </div>
      <ResourceType type="video" />
      {title && <ResourceName name={title} />}
      <div
        className="absolute top-1 left-1 flex aspect-square cursor-pointer items-center justify-center rounded-full bg-white px-1 hover:text-blue-400"
        title="Information"
      >
        <i className="fa-solid fa-circle-info" />
      </div>
      {removing && <ResourceUploadStatus processing={removing} />}
    </div>
  );
};

export default ResourceVideo;
