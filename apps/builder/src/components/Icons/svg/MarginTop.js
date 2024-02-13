// Packages
import React from 'react';

const MarginTop = props => {
  return (
    <svg {...props} viewBox="0 0 16 16">
      <path opacity=".6" fill="currentColor" d="M2 9h12v7H2z" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M5 3l2-.01h2L11 3 8 0 5 3zm11 3v2H0V6h7V3h2v3h7z"
        fill="currentColor"
      />
    </svg>
  );
};

export default MarginTop;
