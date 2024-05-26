// Packages
import React, { useMemo } from 'react';
import classNames from 'classnames';
import get from 'lodash/get';

// Relatives
import Message from './Message';

/**
 * @param {{
 *   className?: string;
 *   id: string;
 *   role: 'assistant' | 'user';
 *   content: object[];
 *   message: object;
 * }} props
 * @returns {React.ReactElement}
 */
const ChatMessage = props => {
  const { className = '', id = '', role = 'assistant', content = [] } = props;
  const roleLabel = role === 'assistant' ? 'Assistant' : 'You';

  const message = useMemo(
    () =>
      content
        .map(item => ({ type: item.type, content: get(item, 'text.value') }))
        .reduce((acum, item) => [...acum, item], []),
    [content]
  );

  // if run_id is null means that still pending to be processed, we should show an icon to indicate that

  return (
    <div className={classNames('flex flex-col text-sm', className)} id={id}>
      <div className="flex gap-1 font-medium text-gray-900">{roleLabel}</div>
      <Message className="text-sm" message={message} />
    </div>
  );
};

export default ChatMessage;
