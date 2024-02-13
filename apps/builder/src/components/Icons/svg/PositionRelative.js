// Packages
import React from 'react';

const PositionRelative = props => {
  return (
    <svg {...props} viewBox="0 0 16 16">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M11 2H9v1h2v3h1V3h2V2h-3zM2 8H1v5h1v-2h5v-1H2V8zm13-1H8v7h7V7z"
        fill="currentColor"
      />
    </svg>
  );
};

export default PositionRelative;
