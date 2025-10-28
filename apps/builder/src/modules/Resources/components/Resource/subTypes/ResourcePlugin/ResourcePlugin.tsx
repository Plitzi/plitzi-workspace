import classNames from 'classnames';
import { useMemo } from 'react';

import PluginContent from './PluginContent';
import ResourceUploadStatus from '../../../ResourceManager/ResourceUploadStatus';
import ResourceRemoveButton from '../../ResourceRemoveButton';

import type { PluginManifest } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

export type ResourcePluginProps = {
  className?: string;
  id: string;
  cdnIdentifier: string;
  src: string;
  metadata?: PluginManifest;
  removing?: boolean;
  onClick?: () => void;
  onRemove?: (e: MouseEvent) => void;
};

const ResourcePlugin = ({ className, metadata, removing, onClick, onRemove }: ResourcePluginProps) => {
  const componentsAvailables = useMemo(() => Object.keys(metadata?.pluginSchema || {}).join(', '), [metadata]);

  return (
    <div
      className={classNames(
        'group relative flex w-full cursor-pointer overflow-hidden rounded-md border border-gray-300 select-none [column-span:all]',
        className
      )}
      onClick={onClick}
    >
      <PluginContent
        className={className}
        name={metadata?.definition.name}
        icon={metadata?.definition.icon}
        backgroundColor={metadata?.definition.backgroundColor}
        version={metadata?.version}
        components={componentsAvailables}
        size={0}
        isUploaded
      />
      <ResourceRemoveButton onRemove={onRemove} />
      {removing && <ResourceUploadStatus processing={removing} />}
    </div>
  );
};

export default ResourcePlugin;
