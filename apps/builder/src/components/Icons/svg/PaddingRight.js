// Packages
import React from 'react';

const PaddingRight = props => {
  return (
    <svg {...props} viewBox="0 0 16 16">
      <path
        opacity=".6"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M16 0H0v16h16V0zm-1 1H1v14h14V1z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M14 2v12h-2V9H9V7h3V2h2zM9 5l-.01 2v2L9 11 6 8l3-3z"
        fill="currentColor"
      />
    </svg>
  );
};

export default PaddingRight;
