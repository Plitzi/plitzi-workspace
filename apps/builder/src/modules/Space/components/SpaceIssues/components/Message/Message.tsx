import { useCallback, useState } from 'react';

import CodeText from '../CodeText';

/** Past this many characters a message is cut to three lines until someone asks for the rest. */
const LONG = 240;

export type MessageProps = {
  text: string;
};

/**
 * What the linter says of one entry. Its messages name every element and value they are about, so the longest run to
 * a paragraph: those start at three lines, the rest a click away, and the list stays one that can be read down.
 */
const Message = ({ text }: MessageProps) => {
  const long = text.length > LONG;
  const [open, setOpen] = useState(false);

  const handleToggle = useCallback(() => setOpen(value => !value), []);

  return (
    <div className="flex flex-col items-start gap-0.5">
      <p
        className={`text-xs leading-relaxed break-words text-zinc-700 dark:text-zinc-200 ${long && !open ? 'line-clamp-3' : ''}`}
      >
        <CodeText text={text} />
      </p>
      {long && (
        <button
          type="button"
          className="text-[11px] font-medium text-indigo-700 hover:underline dark:text-indigo-300"
          aria-expanded={open}
          onClick={handleToggle}
        >
          {open ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
};

export default Message;
