import classNames from 'classnames';

import ResourceUploadStatus from '../../../ResourceManager/ResourceUploadStatus';
import ResourceName from '../../ResourceName';
import ResourceRemoveButton from '../../ResourceRemoveButton';

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
        'group relative flex w-full cursor-pointer flex-col justify-center overflow-hidden rounded-md border border-gray-300 select-none',
        className
      )}
      onClick={onClick}
    >
      <div className="flex aspect-video h-full w-full grow items-center justify-center">
        <i className="fa-solid fa-file fa-2x text-gray-300" title="Unknown" />
      </div>
      <ResourceRemoveButton onRemove={onRemove} />
      {title && <ResourceName name={title} fullWidth />}
      {removing && <ResourceUploadStatus processing={removing} />}
    </div>
  );
};

export default ResourceFile;
