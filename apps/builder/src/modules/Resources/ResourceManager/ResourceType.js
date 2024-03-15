// Packages
import React from 'react';
import PropTypes from 'prop-types';

const ResourceType = props => {
  const { type = 'image' } = props;

  return (
    <div className="absolute bottom-0 right-0 bg-white p-1 rounded-tl flex items-center justify-center">
      {type === 'image' && <i className="fa-solid fa-image" title="Image" />}
      {type === 'video' && <i className="fa-solid fa-film" title="Video" />}
      {type === 'plugin' && <i className="fa-solid fa-puzzle-piece" title="Plugin" />}
    </div>
  );
};

ResourceType.propTypes = {
  type: PropTypes.oneOf(['image', 'video', 'document', 'plugin'])
};

export default ResourceType;
