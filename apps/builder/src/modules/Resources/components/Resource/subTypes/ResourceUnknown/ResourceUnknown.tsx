import classNames from 'classnames';

import ResourceName from '../../../ResourceManager/ResourceName';
import ResourceType from '../../../ResourceManager/ResourceType';
import ResourceUploadStatus from '../../../ResourceManager/ResourceUploadStatus';

import type { ResourceType as TResourceType } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

export type ResourceUnknownProps = {
  className?: string;
  id: string;
  cdnIdentifier: string;
  type: TResourceType;
  title?: string;
  removing?: boolean;
  onClick?: () => void;
  onRemove?: (e: MouseEvent) => void;
};

const ResourceUnknown = ({ className, title, type, removing, onClick, onRemove }: ResourceUnknownProps) => {
  return (
    <div
      className={classNames(
        'group relative flex min-h-20 w-full cursor-pointer overflow-hidden rounded-md border border-gray-300 select-none',
        className
      )}
      onClick={onClick}
    >
      <div className="flex aspect-video h-full w-full items-center justify-center">
        <i className="fa-solid fa-file fa-3x text-gray-300" title="Plugin" />
      </div>
      <div className="absolute top-1 right-1 hidden aspect-square cursor-pointer items-center justify-center rounded-full bg-white px-1 group-hover:flex">
        <i className="fa-solid fa-circle-xmark hover:text-red-400" title="Remove" onClick={onRemove} />
      </div>
      <ResourceType type={type} />
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

export default ResourceUnknown;
