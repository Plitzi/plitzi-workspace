// Packages
import React from 'react';

const PositionAll = props => {
  return (
    <svg {...props} viewBox="0 0 15 15">
      <g fill="currentColor">
        <path d="M3 3h9v9H3z" />
        <path opacity=".3" d="M2 13V2h11v11H2M14 1H1v13h13V1" />
      </g>
    </svg>
  );
};

export default PositionAll;
