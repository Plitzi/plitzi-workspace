// Packages
import React from 'react';

const PaddingLeft = props => {
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
        d="M2 14V2h2v5h3v2H4v5H2zm5-3l.01-2V7L7 5l3 3-3 3z"
        fill="currentColor"
      />
    </svg>
  );
};

export default PaddingLeft;
