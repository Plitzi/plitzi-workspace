// Packages
import React from 'react';

const ListRoman = props => {
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
      <path d="M11 6h9" />
      <path d="M11 12h9" />
      <path d="M11 18h9" />

      <path d="M6 2h.01" />
      <path d="M6 5h0v4h0" />

      <path d="M2 14h.01" />
      <path d="M2 17h0v4h0" />

      <path d="M6 14h.01" />
      <path d="M6 17h0v4h0" />
    </svg>
  );
};

export default ListRoman;
