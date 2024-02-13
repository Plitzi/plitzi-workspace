// Packages
import React from 'react';

const ListCircles = props => {
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
      <path d="M13 7h8" />
      <path d="M13 12h8" />
      <path d="M13 17h8" />
      <path d="M3 7m-2 0a3 3 0 1 0 8 0a3 3 0 1 0 -8 0" />
      <path d="M3 18m-2 0a3 3 0 1 0 8 0a3 3 0 1 0 -8 0" />
    </svg>
  );
};

export default ListCircles;
