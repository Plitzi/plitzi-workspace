// Packages
import React from 'react';
import Markdown from '@plitzi/plitzi-ui-components/Markdown';

/**
 * @param {{
 *   className?: string;
 *   content: string;
 * }} props
 * @returns {React.ReactElement}
 */
const MessageText = props => {
  const { className = '', content = '' } = props;

  return <Markdown className={className}>{content}</Markdown>;
};

export default MessageText;
