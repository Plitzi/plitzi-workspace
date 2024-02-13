// Packages
import React from 'react';

const MarginLeft = props => {
  return (
    <svg {...props} viewBox="0 0 16 16">
      <path opacity=".6" d="M9 2v12h7V2H9z" fill="currentColor" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M6 16h2V0H6v7H3v2h3v7zM3 5l-.01 2v2L3 11 0 8l3-3z"
        fill="currentColor"
      />
    </svg>
  );
};

export default MarginLeft;
