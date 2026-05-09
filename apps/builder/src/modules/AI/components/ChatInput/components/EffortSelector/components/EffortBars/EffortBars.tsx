import clsx from 'clsx';

import { BARS_FILLED } from '../../helpers';

import type { AiEffort } from '@pmodules/AI/types';

export type EffortBarsProps = {
  effort: AiEffort;
  active?: boolean;
};

const EffortBars = ({ effort, active = false }: EffortBarsProps) => {
  const filled = BARS_FILLED[effort];

  return (
    <span className="flex items-end gap-0.5" style={{ height: 10 }}>
      {([4, 7, 10] as const).map((h, i) => (
        <span
          key={i}
          className={clsx(
            'w-0.5 rounded-sm transition-colors',
            i < filled
              ? active
                ? 'bg-emerald-500 dark:bg-emerald-400'
                : 'bg-zinc-400 dark:bg-zinc-500'
              : 'bg-neutral-300 dark:bg-zinc-700'
          )}
          style={{ height: h }}
        />
      ))}
    </span>
  );
};

export default EffortBars;
