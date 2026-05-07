import Button from '@plitzi/plitzi-ui/Button';
import clsx from 'clsx';

import type { AiAttachment, AiMode } from '@pmodules/AI/types';

export type ButtonSendProps = {
  mode: AiMode;
  message?: string;
  attachments?: AiAttachment[];
  disabled?: boolean;
  onClick?: () => void;
};

const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);

const ButtonSend = ({
  mode,
  message = '',
  attachments = [],
  disabled: disabledProp = false,
  onClick
}: ButtonSendProps) => {
  const disabled = (!message.trim() && attachments.length === 0) || disabledProp;

  return (
    <Button
      className={clsx('shrink-0 rounded border-none text-white transition-colors duration-200 disabled:opacity-40', {
        'bg-violet-600 hover:bg-violet-500 disabled:bg-violet-300 dark:disabled:bg-violet-900': mode === 'build',
        'bg-sky-600 hover:bg-sky-500 disabled:bg-sky-300 dark:disabled:bg-sky-900': mode === 'plan',
        'cursor-pointer': !disabled,
        'cursor-not-allowed': disabled
      })}
      size="xs"
      intent="custom"
      disabled={disabled}
      title={`Send (${isMac ? '⌘↵' : 'Ctrl+Enter'})`}
      onClick={onClick}
    >
      <Button.Icon>
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
        </svg>
      </Button.Icon>
    </Button>
  );
};

export default ButtonSend;
