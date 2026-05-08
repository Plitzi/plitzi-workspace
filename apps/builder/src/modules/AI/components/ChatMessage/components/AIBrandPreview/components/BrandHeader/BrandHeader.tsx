import clsx from 'clsx';

import type { AiMode } from '@pmodules/AI/types';

export type BrandHeaderProps = {
  name: string;
  mode?: AiMode;
  hasDark: boolean;
  isDark: boolean;
  onLightMode: () => void;
  onDarkMode: () => void;
};

const BrandHeader = ({ name, mode, hasDark, isDark, onLightMode, onDarkMode }: BrandHeaderProps) => (
  <div className="flex items-center justify-between gap-2 border-b border-zinc-100 bg-zinc-50 px-3 py-1 font-mono text-zinc-600 dark:border-zinc-700/60 dark:bg-zinc-900 dark:text-zinc-400">
    <div className="flex items-center gap-1.5">
      <span className="rounded border border-zinc-300 px-1 text-[9px] tracking-wider uppercase dark:border-zinc-600">
        brand
      </span>
      <span className="font-medium">{name}</span>
    </div>
    <div className="flex shrink-0 items-center gap-1.5">
      {mode === 'plan' && <span className="text-[9px] text-sky-500 dark:text-sky-600">plan</span>}
      {hasDark && (
        <div className="flex overflow-hidden rounded border border-zinc-200 dark:border-zinc-700">
          <button
            onClick={onLightMode}
            className={clsx('px-1.5 py-0.5', {
              'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300': !isDark,
              'text-zinc-400 hover:text-zinc-600 dark:text-zinc-600': isDark
            })}
          >
            ☀
          </button>
          <button
            onClick={onDarkMode}
            className={clsx('px-1.5 py-0.5', {
              'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300': isDark,
              'text-zinc-400 hover:text-zinc-600 dark:text-zinc-600': !isDark
            })}
          >
            ☾
          </button>
        </div>
      )}
    </div>
  </div>
);

export default BrandHeader;
