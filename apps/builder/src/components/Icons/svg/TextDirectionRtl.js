// Packages
import React from 'react';

const TextDirectionRtl = props => {
  return (
    <svg {...props} viewBox="0 0 16 16">
      <path fillRule="evenodd" clipRule="evenodd" d="M0 13l3-3v2h10v2H3v2l-3-3z" fill="currentColor" />
      <path
        opacity=".6"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7 2v8H5V5.95a2.5 2.5 0 010-4.9V1h7v1h-1v8H9V2H7z"
        fill="currentColor"
      />
    </svg>
  );
};

export default TextDirectionRtl;
