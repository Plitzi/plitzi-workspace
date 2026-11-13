import clsx from 'clsx';
import { useCallback } from 'react';

import FlagSource from './FlagSource';

import type { SchemaFlag } from '@plitzi/sdk-shared';
import type { FlagResolution } from '@plitzi/sdk-shared/flags';

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
    <div className="border-ui-line hover:bg-ui-hover grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b px-3 py-1.5 transition-colors">
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={clsx('h-2 w-2 shrink-0 rounded-full', {
              'bg-emerald-500': value,
              'bg-ui-line-strong': !value
            })}
          />
          <span className="text-ui-fg truncate font-mono font-medium" title={name}>
            {name}
          </span>
          <FlagSource resolution={resolution} />
        </div>
        {flag.description && (
          <span className="text-ui-fg-subtle truncate text-[11px]" title={flag.description}>
            {flag.description}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className={clsx('rounded px-1.5 py-0.5 text-[10px] font-medium', {
            'bg-emerald-600 text-white': forced === true,
            'text-ui-fg-subtle hover:bg-ui-hover': forced !== true
          })}
          title="Force this flag on for this browser"
          onClick={handleForceOn}
        >
          On
        </button>
        <button
          type="button"
          className={clsx('rounded px-1.5 py-0.5 text-[10px] font-medium', {
            'dark:text-ui-fg-subtle bg-zinc-700 text-white dark:bg-zinc-300': forced === false,
            'text-ui-fg-subtle hover:bg-ui-hover': forced !== false
          })}
          title="Force this flag off for this browser"
          onClick={handleForceOff}
        >
          Off
        </button>
        {forced !== undefined && (
          <button
            type="button"
            className="text-ui-fg-subtle hover:bg-ui-hover rounded px-1.5 py-0.5 text-[10px]"
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
