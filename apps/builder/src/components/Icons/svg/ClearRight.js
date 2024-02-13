// Packages
import React from 'react';

const ClearRight = props => {
  return (
    <svg {...props} viewBox="0 0 16 16">
      <path opacity=".6" fill="currentColor" d="M11 3h4v4h-4z" />
      <path fill="currentColor" d="M1 3h8v4H1z" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M6 8v1a2 2 0 002 2h4v2H8a4 4 0 01-4-4V8h2zm6.01 5L12 15l3-3-3-3 .01 2v2z"
        fill="currentColor"
      />
    </svg>
  );
};

export default ClearRight;
