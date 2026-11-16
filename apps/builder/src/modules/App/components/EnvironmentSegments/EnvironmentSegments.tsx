import clsx from 'clsx';
import { useCallback, useRef } from 'react';

import { ENVIRONMENT_META } from '../../helpers/environments';

import type { Environment } from '@plitzi/sdk-shared';
import type { KeyboardEvent } from 'react';

export type EnvironmentSegment = {
  value: Environment;
  /** A second line under its name: its latest revision and how old, or that it has none. */
  detail?: string;
  /** The plan that includes it, when the space's does not: shown locked with it, never chosen. */
  lockedBy?: string;
};

export type EnvironmentSegmentsProps = {
  label: string;
  value: Environment;
  segments: readonly EnvironmentSegment[];
  onChange: (value: Environment) => void;
};

/**
 * Which environment, as a segmented control: each segment its name, its dot and a line under it. A locked one is
 * outlined and dimmed with its lock and its plan — never a bright tile that reads as chosen. Arrow keys move between the
 * ones that can be chosen, as a radio group does.
 */
const EnvironmentSegments = ({ label, value, segments, onChange }: EnvironmentSegmentsProps) => {
  const refs = useRef(new Map<Environment, HTMLButtonElement>());
  const open = segments.filter(segment => !segment.lockedBy);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const step =
        event.key === 'ArrowRight' || event.key === 'ArrowDown'
          ? 1
          : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
            ? -1
            : 0;
      if (step === 0 || open.length === 0) {
        return;
      }

      event.preventDefault();
      const at = open.findIndex(segment => segment.value === value);
      const next = open[(at + step + open.length) % open.length];
      onChange(next.value);
      refs.current.get(next.value)?.focus();
    },
    [onChange, open, value]
  );

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-ui-fg text-sm font-medium">{label}</span>
      <div
        role="radiogroup"
        aria-label={label}
        className="bg-ui-raised grid gap-1 rounded-lg p-1"
        style={{ gridTemplateColumns: `repeat(${String(segments.length)}, minmax(0, 1fr))` }}
        onKeyDown={handleKeyDown}
      >
        {segments.map(segment => {
          const meta = ENVIRONMENT_META[segment.value];
          const chosen = segment.value === value;
          const locked = segment.lockedBy !== undefined;

          return (
            <button
              key={segment.value}
              ref={element => {
                if (element) {
                  refs.current.set(segment.value, element);
                } else {
                  refs.current.delete(segment.value);
                }
              }}
              type="button"
              role="radio"
              aria-checked={chosen}
              aria-disabled={locked}
              tabIndex={chosen ? 0 : -1}
              title={locked ? `${meta.label} is included in the ${segment.lockedBy ?? ''} plan` : undefined}
              className={clsx(
                'flex min-w-0 flex-col items-start gap-0.5 rounded-md border px-2.5 py-1.5 text-left transition-colors',
                'focus-visible:ring-primary-500 outline-none focus-visible:ring-2',
                chosen && 'border-ui-line-strong bg-ui-panel text-ui-fg shadow-sm',
                !chosen && !locked && 'text-ui-fg-subtle hover:bg-ui-hover hover:text-ui-fg border-transparent',
                locked && 'text-ui-fg-subtle border-ui-line cursor-not-allowed border-dashed opacity-60'
              )}
              onClick={() => {
                if (!locked) {
                  onChange(segment.value);
                }
              }}
            >
              <span className="flex items-center gap-1.5 text-xs font-semibold">
                {locked ? (
                  <i className="fa-solid fa-lock text-[10px]" />
                ) : (
                  <span className={clsx('h-1.5 w-1.5 rounded-full', meta.dot)} />
                )}
                {meta.label}
              </span>
              <span className="w-full truncate text-[11px]">
                {locked ? `${segment.lockedBy ?? ''} plan` : (segment.detail ?? ' ')}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default EnvironmentSegments;
