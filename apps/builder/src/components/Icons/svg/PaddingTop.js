// Packages
import React from 'react';

const PaddingTop = props => {
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
        d="M2 2h12v2H9v3H7V4H2V2zm3 5l2 .01h2L11 7l-3 3-3-3z"
        fill="currentColor"
      />
    </svg>
  );
};

export default PaddingTop;
