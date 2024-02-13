// Packages
import React from 'react';

const SizeOverflowScroll = props => {
  return (
    <svg {...props} viewBox="0 0 16 16">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M13 2v1l-1-1h1zM9 3l1-1H0v1h9zm0 10H0v1h10l-1-1zm4 0l-1 1h1v-1z"
        fill="currentColor"
      />
      <path
        opacity=".6"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M2 4h7v2H2V4zm0 3h7v2H2V7zm7 3H2v2h7v-2z"
        fill="currentColor"
      />
      <path fillRule="evenodd" clipRule="evenodd" d="M10 4h2v8h-2l3 3 3-3h-2V4h2l-3-3-3 3z" fill="currentColor" />
    </svg>
  );
};

export default SizeOverflowScroll;
