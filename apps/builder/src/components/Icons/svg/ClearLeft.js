// Packages
import React from 'react';

const ClearLeft = props => {
  return (
    <svg {...props} viewBox="0 0 16 16">
      <path opacity=".6" fill="currentColor" d="M1 3h4v4H1z" />
      <path fill="currentColor" d="M7 3h8v4H7z" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10 8v1a2 2 0 01-2 2H4v2h4a4 4 0 004-4V8h-2zm-6.01 5L4 15l-3-3 3-3-.01 2v2z"
        fill="currentColor"
      />
    </svg>
  );
};

export default ClearLeft;
