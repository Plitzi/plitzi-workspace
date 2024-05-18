// Packages
import React, { useMemo } from 'react';
import classNames from 'classnames';

// Relatives
import MessageHtml from './modes/MessageHtml';
import MessageText from './modes/MessageText';

/**
 * @param {{
 *   className?: string;
 *   message: object[];
 * }} props
 * @returns {React.ReactElement}
 */
const Message = props => {
  const { className = '', message = [] } = props;
  const messageParsed = useMemo(
    () =>
      message
        .map(contentItem => {
          const { content, type } = contentItem;
          if (type !== 'text') {
            return [{ type, content }];
          }

          return content.split(/(```\w+?\s*[\s\S]*```)/gim).map(contentPart => {
            if (!contentPart.startsWith('```')) {
              return { type: 'text', content: contentPart };
            }

            const match = contentPart.match(/```(?<codeType>\w+)?\s*(?<code>[\s\S]*?)```/im);
            if (!match) {
              return { type: 'text', content: contentPart };
            }

            return { type: match.groups.codeType, content: match[0] };
          });
        })
        .reduce((acum, item) => [...acum, ...item], []),
    [message]
  );

  return (
    <div className={classNames('flex flex-col gap-4', className)}>
      {messageParsed.map((messageItem, index) => {
        const { type, content } = messageItem;
        if (type === 'text') {
          return <MessageText key={index} content={content} />;
        }

        return <MessageHtml key={index} content={content} />;
      })}
    </div>
  );
};

export default Message;
