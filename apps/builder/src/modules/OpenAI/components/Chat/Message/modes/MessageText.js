// Packages
import React from 'react';
import Markdown from '@plitzi/plitzi-ui-components/Markdown';
import classNames from 'classnames';

/**
 * @param {{
 *   className?: string;
 *   content: string;
 * }} props
 * @returns {React.ReactElement}
 */
const MessageText = props => {
  const { className = '', content = '' } = props;

  return <Markdown className={classNames('text-justify', className)}>{content}</Markdown>;
};

export default MessageText;
