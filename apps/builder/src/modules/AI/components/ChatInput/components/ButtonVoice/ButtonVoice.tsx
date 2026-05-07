import Button from '@plitzi/plitzi-ui/Button';
import clsx from 'clsx';

import type { AiMode } from '@pmodules/AI/types';

export type ButtonVoiceProps = {
  mode: AiMode;
  disabled?: boolean;
  isListening: boolean;
  onVoiceToggle?: () => void;
};

const ButtonVoice = ({ mode, disabled = false, isListening, onVoiceToggle }: ButtonVoiceProps) => {
  return (
    <Button
      className={clsx('shrink-0 rounded border-none p-1.5 transition-colors', {
        'bg-violet-600 text-white': mode === 'build' && isListening,
        'bg-sky-600 text-white': mode === 'plan' && isListening,
        'text-violet-400 hover:bg-violet-100 hover:text-violet-700 dark:text-violet-600 dark:hover:bg-violet-900/50 dark:hover:text-violet-400':
          mode === 'build' && !isListening,
        'text-sky-500 hover:bg-sky-100 hover:text-sky-700 dark:text-sky-600 dark:hover:bg-sky-900/50 dark:hover:text-sky-400':
          mode === 'plan' && !isListening
      })}
      intent="custom"
      title={isListening ? 'Stop recording' : 'Voice input'}
      disabled={disabled}
      onClick={onVoiceToggle}
    >
      <Button.Icon icon="fa-solid fa-microphone" size="xs">
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 1a4 4 0 014 4v6a4 4 0 01-8 0V5a4 4 0 014-4zm0 2a2 2 0 00-2 2v6a2 2 0 004 0V5a2 2 0 00-2-2zm-7 9a7 7 0 0014 0h2a9 9 0 01-8 8.94V22h2v2H9v-2h2v-1.06A9 9 0 013 12h2z" />
        </svg>
      </Button.Icon>
    </Button>
  );
};

export default ButtonVoice;
