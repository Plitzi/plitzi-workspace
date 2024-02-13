// Packages
import React from 'react';

const PaddingBottom = props => {
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
        d="M2 14h12v-2H9V9H7v3H2v2zm3-5l2-.01h2L11 9 8 6 5 9z"
        fill="currentColor"
      />
    </svg>
  );
};

export default PaddingBottom;
