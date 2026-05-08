import clsx from 'clsx';

import type { AiMode } from '@pmodules/AI/types';

export type ButtonVoiceProps = {
  mode: AiMode;
  disabled?: boolean;
  isListening: boolean;
  onVoiceToggle?: () => void;
};

const ButtonVoice = ({ mode, disabled = false, isListening, onVoiceToggle }: ButtonVoiceProps) => (
  <button
    className={clsx(
      'grid h-7 w-7 place-items-center rounded-lg border-0 transition-colors duration-150',
      isListening
        ? mode === 'build'
          ? 'bg-emerald-500 text-white dark:bg-emerald-400'
          : 'bg-sky-500 text-white dark:bg-sky-400'
        : 'bg-transparent text-zinc-500 hover:bg-neutral-200 dark:text-zinc-400 dark:hover:bg-zinc-700'
    )}
    title={isListening ? 'Stop recording' : 'Voice input'}
    disabled={disabled}
    onClick={onVoiceToggle}
  >
    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 1a4 4 0 014 4v6a4 4 0 01-8 0V5a4 4 0 014-4zm0 2a2 2 0 00-2 2v6a2 2 0 004 0V5a2 2 0 00-2-2zm-7 9a7 7 0 0014 0h2a9 9 0 01-8 8.94V22h2v2H9v-2h2v-1.06A9 9 0 013 12h2z" />
    </svg>
  </button>
);

export default ButtonVoice;
