import classNames from 'classnames';
import { useMemo } from 'react';

import PluginContent from './PluginContent';
import ResourceLoading from '../../ResourceLoading';
import ResourceRemoveButton from '../../ResourceRemoveButton';

import type { PluginManifest } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

export type ResourcePluginProps = {
  className?: string;
  id: string;
  src: string;
  metadata?: PluginManifest;
  removing?: boolean;
  isLoading?: boolean;
  onClick?: () => void;
  onRemove?: (e: MouseEvent) => void;
};

const ResourcePlugin = ({
  className,
  metadata,
  removing = false,
  isLoading = false,
  onClick,
  onRemove
}: ResourcePluginProps) => {
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
      {(isLoading || removing) && <ResourceLoading />}
    </div>
  );
};

export default ResourcePlugin;
