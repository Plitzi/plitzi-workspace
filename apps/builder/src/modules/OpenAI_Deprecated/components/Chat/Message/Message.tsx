import { useMemo } from 'react';

import MessageHtml from './modes/MessageHtml';
import MessageText from './modes/MessageText';

import type { OpenAIContentType } from '@pmodules/OpenAI_Deprecated/types/openAI';

export type MessageProps = {
  message: { type: OpenAIContentType; content: string }[];
};

const Message = ({ message = [] }: MessageProps) => {
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

            return { type: match.groups?.codeType as 'html' | 'text', content: match[0] };
          });
        })
        .reduce((acum, item) => [...acum, ...item], []),
    [message]
  );

  return (
    <div className="flex flex-col gap-4">
      {messageParsed.map((messageItem, index) => {
        const { type, content } = messageItem;
        if (type === 'html') {
          return <MessageHtml key={index} content={content} />;
        }

        return <MessageText key={index} content={content} />;
      })}
    </div>
  );
};

export default Message;
