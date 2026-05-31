import clsx from 'clsx';

import { isMac } from '../../helpers';

import type { AiAttachment, AiMode } from '@pmodules/AI/types';

export type ButtonSendProps = {
  mode: AiMode;
  message?: string;
  attachments?: AiAttachment[];
  disabled?: boolean;
  isStreaming?: boolean;
  onClick?: () => void;
  onStop?: () => void;
};

const ButtonSend = ({
  mode,
  message = '',
  attachments = [],
  disabled: disabledProp = false,
  isStreaming = false,
  onClick,
  onStop
}: ButtonSendProps) => {
  if (isStreaming) {
    return (
      <button
        className="grid h-7 w-7 cursor-pointer place-items-center rounded-lg border-0 bg-zinc-700 text-white transition-colors duration-200 hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
        title="Stop generating"
        onClick={onStop}
      >
        <span className="h-2.5 w-2.5 rounded-xs bg-current" />
      </button>
    );
  }

  const disabled = (!message.trim() && attachments.length === 0) || disabledProp;

  return (
    <button
      className={clsx('grid h-7 w-7 place-items-center rounded-lg border-0 transition-colors duration-200', {
        'cursor-not-allowed bg-neutral-200 text-zinc-400 opacity-40 dark:bg-zinc-700 dark:text-zinc-600': disabled,
        'cursor-pointer bg-emerald-500 text-white dark:bg-emerald-400': !disabled && mode === 'build',
        'cursor-pointer bg-sky-500 text-white dark:bg-sky-400': !disabled && mode === 'plan'
      })}
      disabled={disabled}
      title={`Send (${isMac ? '⌘↵' : 'Ctrl+Enter'})`}
      onClick={onClick}
    >
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
      </svg>
    </button>
  );
};

export default ButtonSend;
