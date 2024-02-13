// Packages
import React from 'react';

const BackgroundModeImage = props => {
  return (
    <svg {...props} viewBox="0 0 16 16">
      <path fillRule="evenodd" clipRule="evenodd" d="M15 1H1v14h14V1zm-1 1H2v12h12V2z" fill="currentColor" />
      <rect width="4" height="4" rx="2" transform="translate(4 4)" fill="currentColor" />
      <path d="M3 13h10v-3l-2.5-2.5L3 13z" fill="currentColor" />
    </svg>
  );
};

export default BackgroundModeImage;
