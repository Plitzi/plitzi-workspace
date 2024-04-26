// Packages
import React from 'react';

const MadeInPlitzi = props => {
  const { pageId = '' } = props;

  return (
    <a
      className="made-in-plitzi"
      href="https://plitzi.com"
      data-page-id={pageId}
      rel="noreferrer noopener"
      target="_blank"
    >
      Made in Plitzi
    </a>
  );
};

export default MadeInPlitzi;
