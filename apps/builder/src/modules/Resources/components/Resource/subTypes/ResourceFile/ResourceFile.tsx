import classNames from 'classnames';

import ResourceName from '../../../ResourceManager/ResourceName';
import ResourceUploadStatus from '../../../ResourceManager/ResourceUploadStatus';

import type { MouseEvent } from 'react';

export type ResourceFileProps = {
  className?: string;
  id: string;
  cdnIdentifier: string;
  title?: string;
  removing?: boolean;
  onClick?: () => void;
  onRemove?: (e: MouseEvent) => void;
};

const ResourceFile = ({ className, title, removing, onClick, onRemove }: ResourceFileProps) => {
  return (
    <div
      className={classNames(
        'group relative flex min-h-18 w-full cursor-pointer overflow-hidden rounded-md border border-gray-300 select-none',
        className
      )}
      onClick={onClick}
    >
      <div className="flex aspect-video h-full w-full items-center justify-center">
        <i className="fa-solid fa-file fa-2x text-gray-300" title="Unknown" />
      </div>
      <div className="absolute top-1/2 left-1/2 hidden aspect-square -translate-1/2 cursor-pointer items-center justify-center rounded-full bg-white px-1 group-hover:flex">
        <i className="fa-solid fa-circle-xmark hover:text-red-400" title="Remove" onClick={onRemove} />
      </div>
      {title && <ResourceName name={title} fullWidth />}
      {removing && <ResourceUploadStatus processing={removing} />}
    </div>
  );
};

export default ResourceFile;
