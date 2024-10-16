// Packages
import React, { useMemo } from 'react';
import classNames from 'classnames';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Relatives
import ContentPlugin from './contents/ContentPlugin';

/**
 * @param {{
 *   className?: string;
 *   src?: string;
 *   type?: 'image' | 'video' | 'document' | 'plugin';
 *   title?: string;
 *   metadata?: object;
 *   size?: number;
 *   isUploaded?: boolean;
 * }} props
 * @returns {React.ReactElement}
 */
const ResourceContent = props => {
  const {
    className = 'w-full h-full aspect-video',
    src = '',
    type = 'image',
    title = '',
    metadata = emptyObject,
    size = 0,
    isUploaded = false
  } = props;

  const componentsAvailables = useMemo(() => {
    return Object.keys(metadata?.pluginSchema || {}).join(', ');
  }, [metadata]);

  return (
    <>
      {type === 'image' && <img draggable={false} src={src} alt={title} className={className} />}
      {type === 'video' && <video draggable={false} src={src} muted className={className} />}
      {type === 'plugin' && (
        <ContentPlugin
          className={className}
          name={metadata?.definition?.name}
          icon={metadata?.definition?.icon}
          backgroundColor={metadata?.definition?.backgroundColor}
          version={metadata?.version}
          components={componentsAvailables}
          size={size}
          isUploaded={isUploaded}
        />
      )}
      {!['image', 'video', 'plugin'].includes(type) && (
        <div className={classNames('flex items-center justify-center', className)}>
          <i className="fa-solid fa-file fa-3x text-gray-300" title="Plugin" />
        </div>
      )}
    </>
  );
};

export default ResourceContent;
