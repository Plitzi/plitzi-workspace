import clsx from 'clsx';

import type { AiMode } from '@pmodules/AI/types';

export type LiveAvatarProps = {
  mode: AiMode;
};

const LiveAvatar = ({ mode }: LiveAvatarProps) => (
  <div
    className={clsx(
      'mt-0.5 grid h-5.5 w-5.5 shrink-0 place-items-center rounded-[5px] border bg-neutral-50 font-mono text-[9px] font-bold dark:bg-zinc-800',
      {
        'border-emerald-500/50 text-emerald-500 dark:border-emerald-400/50 dark:text-emerald-400': mode === 'build',
        'border-sky-500/50 text-sky-500 dark:border-sky-400/50 dark:text-sky-400': mode === 'plan'
      }
    )}
  >
    P
  </div>
);

export default LiveAvatar;
