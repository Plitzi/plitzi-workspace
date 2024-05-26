// Packages
import React, { useMemo } from 'react';
import classNames from 'classnames';

// Relatives
import ChatMessage from './ChatMessage';

/**
 * @param {{
 *   className?: string;
 *   messages: object[];
 * }} props
 * @returns {React.ReactElement}
 */
const Chat = props => {
  const { ref, className = '', messages = [] } = props;
  const messagesParsed = useMemo(() => messages?.filter(Boolean) ?? [], [messages]);

  return (
    <div className={classNames('flex min-h-0', className)} ref={ref}>
      <div className="flex flex-col w-full overflow-y-auto gap-4">
        {messagesParsed.map(message => (
          <ChatMessage
            key={message.id}
            id={message.id}
            role={message.role}
            content={message.content}
            type={message.object}
          />
        ))}
      </div>
    </div>
  );
};

export default Chat;
