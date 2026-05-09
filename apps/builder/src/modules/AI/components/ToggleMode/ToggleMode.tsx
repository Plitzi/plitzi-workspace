import clsx from 'clsx';
import { useCallback } from 'react';

import type { AiMode } from '@pmodules/AI/types';

export type ToggleModeProps = { mode: AiMode; disabled?: boolean; onModeChange?: (mode: AiMode) => void };

const ToggleMode = ({ mode, disabled = false, onModeChange }: ToggleModeProps) => {
  const handleClick = useCallback(() => onModeChange?.(mode === 'plan' ? 'build' : 'plan'), [mode, onModeChange]);

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      title={`Switch to ${mode === 'plan' ? 'build' : 'plan'} mode (Alt+P)`}
      className={clsx(
        'flex shrink-0 items-center gap-1.5 rounded border px-2 py-1 font-mono text-[9.5px] font-semibold tracking-wider uppercase transition-colors disabled:opacity-40',
        {
          'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:border-emerald-400/40 dark:bg-emerald-400/10 dark:text-emerald-400':
            mode === 'build',
          'border-sky-500/40 bg-sky-500/10 text-sky-600 hover:bg-sky-500/20 dark:border-sky-400/40 dark:bg-sky-400/10 dark:text-sky-400':
            mode === 'plan'
        }
      )}
    >
      <span
        className={clsx('h-1.5 w-1.5 shrink-0 rounded-full', {
          'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.7)] dark:bg-emerald-400': mode === 'build',
          'bg-sky-500 shadow-[0_0_5px_rgba(14,165,233,0.7)] dark:bg-sky-400': mode === 'plan'
        })}
      />
      {mode}
      <span className="opacity-40">⇄</span>
    </button>
  );
};

export default ToggleMode;
