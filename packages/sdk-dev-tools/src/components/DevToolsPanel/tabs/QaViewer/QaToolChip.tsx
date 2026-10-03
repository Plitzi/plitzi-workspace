import clsx from 'clsx';
import { use, useCallback } from 'react';

import QaContext from '../../../../qa/QaContext';

import type { QaSwitch } from '../../../../qa/qaSettings';

export type QaToolChipProps = {
  setting: QaSwitch;
  label: string;
  icon: string;
  /** What it shows, said on hover. */
  title: string;
  /** The one tool the bar leads with. */
  primary?: boolean;
};

/** One tool in the bar, on or off. */
const QaToolChip = ({ setting, label, icon, title, primary = false }: QaToolChipProps) => {
  const { settings, setSetting } = use(QaContext);
  const on = settings[setting];

  const handleClick = useCallback(() => setSetting(setting, !on), [setSetting, setting, on]);

  return (
    <button
      type="button"
      aria-pressed={on}
      title={title}
      className={clsx(
        'flex h-6 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border px-2 font-medium whitespace-nowrap transition-colors',
        {
          'border-violet-500 bg-violet-500 text-white': on && primary,
          'border-violet-400/60 bg-violet-500/10 text-violet-700 dark:text-violet-300': on && !primary,
          'border-violet-300 text-violet-700 hover:bg-violet-500/10 dark:border-violet-500/50 dark:text-violet-300':
            !on && primary,
          'border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800':
            !on && !primary
        }
      )}
      onClick={handleClick}
    >
      <i className={clsx(icon, 'text-[10px]')} />
      {label}
    </button>
  );
};

export default QaToolChip;
