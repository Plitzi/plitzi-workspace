// Packages
import React from 'react';

const PositionFixed = props => {
  return (
    <svg {...props} viewBox="0 0 16 16">
      <path
        opacity=".6"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M15 2h-1v2h-1v1h1v1h1V2zm-5 3V4H9V2H1v6h1V5h8zM7 4V3H5v1h2zM4 4V3H2v1h2zm-3 9h6v1H1v-1z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M11 2h-1v1h1v3h1V3h1V2h-2zM2 9H1v3h1v-1h5v-1H2V9zm13-2H8v7h7V7z"
        fill="currentColor"
      />
    </svg>
  );
};

export default PositionFixed;
