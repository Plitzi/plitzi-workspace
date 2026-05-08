import { useCallback } from 'react';

import ToggleItem from './ToggleItem';

import type { AiMode } from '@pmodules/AI/types';

export type ToggleModeProps = { mode: AiMode; disabled: boolean; onModeChange?: (mode: AiMode) => void };

const ToggleMode = ({ mode, disabled = false, onModeChange }: ToggleModeProps) => {
  const handleClickMode = useCallback((m: AiMode) => onModeChange?.(m), [onModeChange]);

  return (
    <div className="flex shrink-0 items-center overflow-hidden rounded border border-neutral-300 p-0.5 font-mono text-[10px] dark:border-zinc-700">
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
