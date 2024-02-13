// Packages
import React from 'react';

const PositionSticky = props => {
  return (
    <svg {...props} viewBox="0 0 16 16">
      <g clipPath="url(#wf-svg-position-sticky-a)" fill="currentColor">
        <path d="M13 7a3 3 0 10-2.648-1.59l-3.47 3.47a.875.875 0 101.237 1.24l3.47-3.472c.42.225.9.352 1.41.352z" />
        <path
          opacity=".6"
          fillRule="evenodd"
          clipRule="evenodd"
          d="M9.535 2H1v12h14V7.465c-.31.18-.645.318-1 .41V13H2V5h7.126a4.007 4.007 0 01.41-3zM7 3v1H5V3h2zM4 3v1H2V3h2z"
        />
      </g>
      <defs>
        <clipPath id="wf-svg-position-sticky-a">
          <path fill="#fff" d="M0 0h16v16H0z" />
        </clipPath>
      </defs>
    </svg>
  );
};

export default PositionSticky;
