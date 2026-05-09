import clsx from 'clsx';

import KeyboardKey from '@pmodules/AI/components/KeyboardKey';
import { useAiChatContext } from '@pmodules/AI/contexts/AiChatContext';

export type HistoryFooterProps = {
  onNew: () => void;
};

const HistoryFooter = ({ onNew }: HistoryFooterProps) => {
  const { currentMode } = useAiChatContext();

  return (
    <div className="flex shrink-0 items-center gap-3 border-t border-neutral-200 bg-neutral-100 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-3 font-mono text-[9px] text-zinc-400 dark:text-zinc-600">
        <span className="flex items-center gap-1">
          <KeyboardKey char="↑" commandChar={false} />
          <KeyboardKey char="↓" commandChar={false} />
          navigate
        </span>
        <span className="flex items-center gap-1">
          <KeyboardKey char="↵" commandChar={false} />
          open
        </span>
        <span className="flex items-center gap-1">
          <KeyboardKey char="1-9" />
          jump
        </span>
        <span className="flex items-center gap-1">
          <KeyboardKey char="esc" commandChar={false} />
          close
        </span>
      </div>
      <div className="flex-1" />
      <button
        onClick={onNew}
        className={clsx(
          'flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[10px] transition-colors',
          {
            'border-emerald-500/50 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 dark:border-emerald-400/50 dark:bg-emerald-400/10 dark:text-emerald-400':
              currentMode === 'build',
            'border-sky-500/50 bg-sky-500/10 text-sky-500 hover:bg-sky-500/20 dark:border-sky-400/50 dark:bg-sky-400/10 dark:text-sky-400':
              currentMode === 'plan'
          }
        )}
      >
        <i className="fa-solid fa-plus text-[9px]" />
        New chat
      </button>
    </div>
  );
};

export default HistoryFooter;
