// Packages
import React from 'react';

const MarginBottom = props => {
  return (
    <svg {...props} viewBox="0 0 16 16">
      <path opacity=".6" fill="currentColor" d="M2 7h12V0H2z" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9 10h7V8H0v2h7v3h2v-3zm-4 3l2 .01h2l2-.01-3 3-3-3z"
        fill="currentColor"
      />
    </svg>
  );
};

export default MarginBottom;
