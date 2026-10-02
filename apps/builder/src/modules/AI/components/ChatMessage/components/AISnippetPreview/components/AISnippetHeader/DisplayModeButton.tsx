import clsx from 'clsx';
import { useCallback } from 'react';

import type { DisplayMode } from '@plitzi/sdk-shared';

export type DisplayModeButtonProps = {
  mode: DisplayMode;
  icon: string;
  active: boolean;
  onDisplayMode: (mode: DisplayMode) => void;
};

const DisplayModeButton = ({ mode, icon, active, onDisplayMode }: DisplayModeButtonProps) => {
  const handleClick = useCallback(() => onDisplayMode(mode), [mode, onDisplayMode]);

  return (
    <button
      onClick={handleClick}
      title={mode}
      className={clsx('cursor-pointer rounded px-1 py-0.5 transition-colors', {
        'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300': active,
        'text-zinc-400 hover:text-zinc-600 dark:text-zinc-600 dark:hover:text-zinc-400': !active
      })}
    >
      <i className={icon} />
    </button>
  );
};

export default DisplayModeButton;
