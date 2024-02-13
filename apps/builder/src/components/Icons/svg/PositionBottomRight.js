// Packages
import React from 'react';

const PositionBottomRight = props => {
  return (
    <svg {...props} viewBox="0 0 15 15">
      <path fill="currentColor" d="M8 8h4v4H8z" />
      <path opacity=".3" fill="currentColor" d="M2 13V2h11v11H2M14 1H1v13h13V1" />
    </svg>
  );
};

export default PositionBottomRight;
