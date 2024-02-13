// Packages
import React from 'react';

const TextDirectionLtr = props => {
  return (
    <svg {...props} viewBox="0 0 16 16">
      <path
        opacity=".6"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7 2v8H5V5.95a2.5 2.5 0 010-4.9V1h7v1h-1v8H9V2H7z"
        fill="currentColor"
      />
      <path fillRule="evenodd" clipRule="evenodd" d="M16 13l-3-3v2H3v2h10v2l3-3z" fill="currentColor" />
    </svg>
  );
};

export default TextDirectionLtr;
