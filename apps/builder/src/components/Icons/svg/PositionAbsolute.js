// Packages
import React from 'react';

const PositionAbsolute = props => {
  return (
    <svg {...props} viewBox="0 0 16 16">
      <path
        opacity=".6"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M14 2h1v4h-1V2zM9 3V2H1v6h1V3h7zM7 13H1v1h6v-1z"
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

export default PositionAbsolute;
