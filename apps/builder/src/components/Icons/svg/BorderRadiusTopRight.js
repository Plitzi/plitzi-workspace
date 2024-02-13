// Packages
import React from 'react';

const BorderRadiusBottomLeft = props => {
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
      <path d="M5 5h6a8 8 0 0 1 8 8v6" />
    </svg>
  );
};

export default BorderRadiusBottomLeft;
