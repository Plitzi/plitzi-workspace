// Packages
import React, { forwardRef } from 'react';
import PropTypes from 'prop-types';

const BuilderCollaboratorCursor = forwardRef((props, ref) => {
  const { title = '', color = '#000', scale = 1 } = props;

  return (
    <div ref={ref} className="builder-collaborator-cursor" style={{ color, fontSize: `${16 * (1 / scale)}px` }}>
      <i className="fas fa-mouse-pointer" />
      <div className="cursor-username" style={{ backgroundColor: color }}>
        {title}
      </div>
    </div>
  );
});

BuilderCollaboratorCursor.propTypes = {
  title: PropTypes.string,
  color: PropTypes.string,
  scale: PropTypes.number
};

export default BuilderCollaboratorCursor;
