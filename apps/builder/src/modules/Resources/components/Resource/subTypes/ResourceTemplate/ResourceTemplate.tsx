import classNames from 'classnames';
import { useEffect, useState } from 'react';

import fetchManifest from '@plitzi/sdk-shared/helpers/fetchManifest';
import useDragElement from '@pmodules/Elements/hooks/useDragElement';

import TemplateContent from './TemplateContent';
import ResourceName from '../../../ResourceManager/ResourceName';
import ResourceType from '../../../ResourceManager/ResourceType';
import ResourceUploadStatus from '../../../ResourceManager/ResourceUploadStatus';

import type { Template } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

export type ResourceTemplateProps = {
  className?: string;
  id: string;
  cdnIdentifier: string;
  src: string;
  title?: string;
  removing?: boolean;
  onClick?: () => void;
  onRemove?: (e: MouseEvent) => void;
};

const ResourceTemplate = ({ className, title, src, removing, onClick, onRemove }: ResourceTemplateProps) => {
  const [manifest, setManifest] = useState<Template | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchManifest<Template>(src)
      .then(result => {
        setManifest(result);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [src]);

  const { onDragStart } = useDragElement({ type: 'template', manifest });

  if (loading) {
    return undefined;
  }

  return (
    <div
      onDragStart={onDragStart}
      draggable
      className={classNames(
        'group relative flex min-h-[164px] w-full cursor-grabbing overflow-hidden rounded-md border border-gray-300 select-none',
        className
      )}
      onClick={onClick}
    >
      {manifest && (
        <TemplateContent
          name={manifest.definition.name}
          baseElementId={manifest.definition.baseElementId}
          schema={manifest.schema}
          style={manifest.style}
        />
      )}
      <div className="absolute top-1 right-1 hidden aspect-square cursor-pointer items-center justify-center rounded-full bg-white px-1 group-hover:flex">
        <i className="fa-solid fa-circle-xmark hover:text-red-400" title="Remove" onClick={onRemove} />
      </div>
      <ResourceType type="template" />
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

export default ResourceTemplate;
