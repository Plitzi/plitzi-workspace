// Packages
import React from 'react';

const BackgroundModeLinearGradient = props => {
  return (
    <svg {...props} viewBox="0 0 16 16">
      <path transform="translate(3 3)" fill="url(#p-svg-background-linear-gradient-a)" d="M0 0h10v10H0z" />
      <path fillRule="evenodd" clipRule="evenodd" d="M15 1H1v14h14V1zm-1 1H2v12h12V2z" fill="currentColor" />
      <defs>
        <linearGradient
          id="p-svg-background-linear-gradient-a"
          x2="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="matrix(0 10 -10 0 10 0)"
        >
          <stop stopColor="currentColor" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
};

export default BackgroundModeLinearGradient;
