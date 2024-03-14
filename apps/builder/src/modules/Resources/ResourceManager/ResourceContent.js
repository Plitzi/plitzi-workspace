// Packages
import React from 'react';
import PropTypes from 'prop-types';

const ResourceContent = props => {
  const { className = 'w-full h-full aspect-video', src = '', type = 'image', title = '' } = props;

  return (
    <>
      {type === 'image' && <img draggable={false} src={src} alt={title} className={className} />}
      {type === 'video' && <video draggable={false} src={src} muted className={className} />}
    </>
  );
};

ResourceContent.propTypes = {
  className: PropTypes.string,
  src: PropTypes.string,
  type: PropTypes.oneOf(['image', 'video', 'document']),
  title: PropTypes.string
};

export default ResourceContent;
