import clsx from 'clsx';
import { useCallback } from 'react';

import ToggleItem from './ToggleItem';

import type { AiMode } from '@pmodules/AI/types';

export type ToggleModeProps = { mode: AiMode; disabled: boolean; onModeChange?: (mode: AiMode) => void };

const ToggleMode = ({ mode, disabled = false, onModeChange }: ToggleModeProps) => {
  const handleClickMode = useCallback((mode: AiMode) => onModeChange?.(mode), [onModeChange]);

  return (
    <div
      className={clsx(
        'flex shrink-0 items-center overflow-hidden rounded border p-0.5 font-mono text-[10px] transition-colors duration-200',
        {
          'border-violet-300 dark:border-violet-800/60': mode === 'build',
          'border-sky-300 dark:border-sky-800/60': mode === 'plan'
        }
      )}
    >
      {(['plan', 'build'] as AiMode[]).map(m => (
        <ToggleItem
          key={m}
          mode={m}
          active={mode === m}
          disabled={disabled}
          title={m === 'plan' ? 'Plan — analysis only, no changes (ALT+P)' : 'Build — full implementation (ALT+P)'}
          onClick={handleClickMode}
        />
      ))}
    </div>
  );
};

export default ToggleMode;
