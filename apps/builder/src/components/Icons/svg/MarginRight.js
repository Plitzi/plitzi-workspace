// Packages
import React from 'react';

const MarginRight = props => {
  return (
    <svg {...props} viewBox="0 0 16 16">
      <path opacity=".6" fill="currentColor" d="M7 2v12H0V2z" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10 9v7H8V0h2v7h3v2h-3zm3-4l.01 2v2L13 11l3-3-3-3z"
        fill="currentColor"
      />
    </svg>
  );
};

export default MarginRight;
