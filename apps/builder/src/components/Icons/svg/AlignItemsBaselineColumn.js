// Packages
import React from 'react';

const AlignItemsBaselineColumn = props => {
  return (
    <svg {...props} viewBox="0 0 16 16">
      <path fill="currentColor" d="M7 0h1v16H7z" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 3H3v4h9V3zM7 4H4v2h3V4zm3 4H3v4h7V8zM7 9H4v2h3V9z"
        fill="currentColor"
      />
    </svg>
  );
};

export default AlignItemsBaselineColumn;
