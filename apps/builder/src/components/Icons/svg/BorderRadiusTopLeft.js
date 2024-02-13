// Packages
import React from 'react';

const BorderRadiusTopLeft = props => {
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
      <path d="M5 19v-6a8 8 0 0 1 8 -8h6" />
    </svg>
  );
};

export default BorderRadiusTopLeft;
