// Packages
import React from 'react';
import PropTypes from 'prop-types';

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

MadeInPlitzi.propTypes = {
  pageId: PropTypes.string
};

export default MadeInPlitzi;
