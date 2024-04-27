// Packages
import React from 'react';

/**
 * @param {{
 *   ref: React.RefObject<HTMLDivElement>;
 *   title?: string;
 *   color?: string;
 *   scale?: number;
 * }} props
 * @returns {React.ReactElement}
 */
const BuilderCollaboratorCursor = props => {
  const { ref, title = '', color = '#000', scale = 1 } = props;

  return (
    <div ref={ref} className="builder-collaborator-cursor" style={{ color, fontSize: `${16 * (1 / scale)}px` }}>
      <i className="fas fa-mouse-pointer" />
      <div className="cursor-username" style={{ backgroundColor: color }}>
        {title}
      </div>
    </div>
  );
};

export default BuilderCollaboratorCursor;
