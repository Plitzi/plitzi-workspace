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
    <div className={classNames('flex items-start', className)} id={id}>
      <div className="flex-shrink-0">
        <img
          className="h-8 w-8 rounded-full border border-gray-300 p-0.5"
          src="https://banner2.cleanpng.com/20180329/zue/kisspng-computer-icons-user-profile-person-5abd85306ff7f7.0592226715223698404586.jpg"
          alt=""
        />
      </div>
      <div className="flex flex-col grow basis-0 min-w-0 ml-3">
        <div className="flex gap-1 text-sm font-medium text-gray-900">{roleLabel}</div>
        <Message className="text-sm basis-0 min-w-0 grow" message={message} />
      </div>
    </div>
  );
};

export default ChatMessage;
