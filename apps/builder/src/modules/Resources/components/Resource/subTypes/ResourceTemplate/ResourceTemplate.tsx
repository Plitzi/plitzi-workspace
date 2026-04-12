import clsx from 'clsx';
import { useEffect, useState } from 'react';

import fetchManifest from '@plitzi/sdk-shared/helpers/fetchManifest';
import useDragElement from '@pmodules/Elements/hooks/useDragElement';

import TemplateContent from './TemplateContent';
import ResourceLoading from '../../ResourceLoading';
import ResourceName from '../../ResourceName';
import ResourceRemoveButton from '../../ResourceRemoveButton';

import type { Template } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

export type ResourceTemplateProps = {
  className?: string;
  id: string;
  src: string;
  title?: string;
  removing?: boolean;
  isLoading?: boolean;
  onClick?: () => void;
  onRemove?: (e: MouseEvent) => void;
};

const ResourceTemplate = ({
  className,
  title,
  src,
  removing = false,
  isLoading = false,
  onClick,
  onRemove
}: ResourceTemplateProps) => {
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

  if (loading || !manifest) {
    return undefined;
  }

  const { definition, schema, style } = manifest;

  return (
    <div
      onDragStart={onDragStart}
      draggable
      className={clsx(
        'group relative flex w-full cursor-grabbing flex-col overflow-hidden rounded-md border border-gray-300 select-none [column-span:all] dark:border-zinc-600',
        className
      )}
      onClick={onClick}
    >
      <TemplateContent baseElementId={definition.baseElementId} schema={schema} style={style} />
      <ResourceRemoveButton onRemove={onRemove} />
      {(isLoading || removing) && <ResourceLoading />}
      <ResourceName name={definition.name ? definition.name : title} />
    </div>
  );
};

export default ResourceTemplate;
