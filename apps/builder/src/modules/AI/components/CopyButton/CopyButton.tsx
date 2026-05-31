import clsx from 'clsx';
import { useCallback, useState } from 'react';

export type CopyButtonProps = {
  text: string;
  title?: string;
  className?: string;
};

const CopyButton = ({ text, title = 'Copy', className }: CopyButtonProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={title}
      className={clsx(
        'flex items-center gap-1 rounded px-1.5 py-0.5 text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200',
        className
      )}
    >
      {!copied && (
        <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
          <path d="M10.5 5.5V3.5A1.5 1.5 0 0 0 9 2H3.5A1.5 1.5 0 0 0 2 3.5V9a1.5 1.5 0 0 0 1.5 1.5h2" />
        </svg>
      )}
      {copied && <span className="text-emerald-500 dark:text-emerald-400">copied</span>}
    </button>
  );
};

export default CopyButton;
