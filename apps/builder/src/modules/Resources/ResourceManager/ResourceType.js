// Packages
import React from 'react';

/**
 * @param {{
 *   type?: 'image' | 'video' | 'plugin' | 'document';
 * }} props
 * @returns {React.ReactElement}
 */
const ResourceType = props => {
  const { type = 'image' } = props;

  return (
    <div className="absolute bottom-0 right-0 bg-white p-1 rounded-tl flex items-center justify-center">
      {type === 'image' && <i className="fa-solid fa-image" title="Image" />}
      {type === 'video' && <i className="fa-solid fa-film" title="Video" />}
      {type === 'plugin' && <i className="fa-solid fa-puzzle-piece" title="Plugin" />}
      {!['image', 'video', 'plugin'].includes(type) && <i className="fa-solid fa-file" title="Plugin" />}
    </div>
  );
};

export default ResourceType;
