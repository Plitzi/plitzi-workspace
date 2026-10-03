import clsx from 'clsx';

import type { ReactNode } from 'react';

export type QaSwitchProps = {
  label: string;
  description: string;
  on: boolean;
  onToggle: () => void;
  /** Beside the label: what the tool found, say. */
  extra?: ReactNode;
};

/** One tool: what it is, what it shows, and its switch — the whole row is the button. */
const QaSwitch = ({ label, description, on, onToggle, extra }: QaSwitchProps) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    className="grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-zinc-100 px-3 py-2 text-left transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/60"
    onClick={onToggle}
  >
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="flex items-center gap-2 font-medium text-zinc-800 dark:text-zinc-200">
        {label}
        {extra}
      </span>
      <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{description}</span>
    </span>
    <span
      className={clsx('relative h-4 w-7 shrink-0 rounded-full transition-colors', {
        'bg-violet-500': on,
        'bg-zinc-300 dark:bg-zinc-600': !on
      })}
    >
      <span
        className={clsx('absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform', {
          'translate-x-3': on
        })}
      />
    </span>
  </button>
);

export default QaSwitch;
