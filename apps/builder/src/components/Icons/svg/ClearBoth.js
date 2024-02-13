// Packages
import React from 'react';

const ClearBoth = props => {
  return (
    <svg {...props} viewBox="0 0 16 16">
      <path fill="currentColor" d="M2 3h12v4H2z" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9 8v1a2 2 0 002 2h2v2h-2a4 4 0 01-4-4V8h2zm4.01 5L13 15l3-3-3-3 .01 2v2z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7 8v1a2 2 0 01-2 2H3v2h2a4 4 0 004-4V8H7zm-4.01 5L3 15l-3-3 3-3-.01 2v2z"
        fill="currentColor"
      />
    </svg>
  );
};

export default ClearBoth;
