import clsx from 'clsx';

import type { FlagResolution } from '@plitzi/sdk-shared';

export type FlagSourceProps = { resolution?: FlagResolution };

const LAYER_LABELS: Record<FlagResolution['layer'], string> = {
  space: 'default',
  server: 'server',
  sdk: 'sdk',
  qa: 'forced'
};

/** Which layer decided the flag — and, when the space did with a rule, which rule. */
const FlagSource = ({ resolution }: FlagSourceProps) => {
  if (!resolution) {
    return null;
  }

  const { layer, rule } = resolution;
  const label = layer === 'space' && rule !== undefined ? `rule ${rule + 1}` : LAYER_LABELS[layer];

  return (
    <span
      className={clsx('rounded px-1.5 py-0.5 text-[10px] font-medium tracking-wider uppercase', {
        'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400': layer === 'space',
        'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300': layer === 'server' || layer === 'sdk',
        'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300': layer === 'qa'
      })}
      title="Which layer decided this flag"
    >
      {label}
    </span>
  );
};

export default FlagSource;
