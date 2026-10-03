import clsx from 'clsx';
import { useCallback } from 'react';

import FlagSource from './FlagSource';

import type { FlagResolution, SchemaFlag } from '@plitzi/sdk-shared';

export type FlagsListItemProps = {
  name: string;
  flag: SchemaFlag;
  resolution?: FlagResolution;
  /** What a tester forced this flag to, if anything. */
  forced?: boolean;
  onForce: (name: string, value: boolean | undefined) => void;
};

const FlagsListItem = ({ name, flag, resolution, forced, onForce }: FlagsListItemProps) => {
  const value = resolution?.value ?? false;

  const handleForceOn = useCallback(() => onForce(name, true), [name, onForce]);
  const handleForceOff = useCallback(() => onForce(name, false), [name, onForce]);
  const handleClear = useCallback(() => onForce(name, undefined), [name, onForce]);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-zinc-100 px-3 py-1.5 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/60">
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={clsx('h-2 w-2 shrink-0 rounded-full', {
              'bg-emerald-500': value,
              'bg-zinc-300 dark:bg-zinc-600': !value
            })}
          />
          <span className="truncate font-mono font-medium text-zinc-800 dark:text-zinc-200" title={name}>
            {name}
          </span>
          <FlagSource resolution={resolution} />
        </div>
        {flag.description && (
          <span className="truncate text-[11px] text-zinc-400 dark:text-zinc-500" title={flag.description}>
            {flag.description}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className={clsx('rounded px-1.5 py-0.5 text-[10px] font-medium', {
            'bg-emerald-600 text-white': forced === true,
            'text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800': forced !== true
          })}
          title="Force this flag on for this browser"
          onClick={handleForceOn}
        >
          On
        </button>
        <button
          type="button"
          className={clsx('rounded px-1.5 py-0.5 text-[10px] font-medium', {
            'bg-zinc-700 text-white dark:bg-zinc-300 dark:text-zinc-900': forced === false,
            'text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800': forced !== false
          })}
          title="Force this flag off for this browser"
          onClick={handleForceOff}
        >
          Off
        </button>
        {forced !== undefined && (
          <button
            type="button"
            className="rounded px-1.5 py-0.5 text-[10px] text-zinc-400 hover:bg-zinc-100 dark:text-zinc-500 dark:hover:bg-zinc-800"
            title="Stop forcing it: the space and its embedding decide again"
            onClick={handleClear}
          >
            <i className="fa-solid fa-rotate-left" />
          </button>
        )}
      </div>
    </div>
  );
};

export default FlagsListItem;
