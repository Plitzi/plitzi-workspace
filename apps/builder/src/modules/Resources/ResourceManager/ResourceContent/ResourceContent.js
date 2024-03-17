// Packages
import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Relatives
import ContentPlugin from './contents/ContentPlugin';

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
    </>
  );
};

ResourceContent.propTypes = {
  className: PropTypes.string,
  src: PropTypes.string,
  type: PropTypes.oneOf(['image', 'video', 'document', 'plugin']),
  title: PropTypes.string,
  metadata: PropTypes.object,
  size: PropTypes.number,
  isUploaded: PropTypes.bool
};

export default ResourceContent;
