// Packages
import React from 'react';

const TextAlignLeft = props => {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      strokeWidth="2"
      stroke="currentColor"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M4 6l16 0" />
      <path d="M4 12l10 0" />
      <path d="M4 18l14 0" />
    </svg>
  );
};

export default TextAlignLeft;
