import clsx from 'clsx';

import NeedsLook from '../../../NeedsLook';
import StatePill from '../StatePill';

import type { FlowState } from '../../../../studio/TestStudioContext';
import type { E2eTest } from '@plitzi/sdk-shared';

export type FlowRowProps = {
  journey: E2eTest;
  /** Its letter: its place in the whole list, kept while the list is filtered. */
  letter: string;
  /** What it does first, in words. */
  firstLine: string;
  state: FlowState;
  chosen: boolean;
  /** Chosen and changed since it was saved. */
  unsaved: boolean;
  /** The tag the list is filtered by: lit where the journey carries it. */
  tag?: string;
  problems: readonly string[];
  /** How the server last played it, when it did. */
  onServer?: { ok: boolean };
  /** Whether it may be chosen now: not while every journey plays. */
  selectable: boolean;
  /** Whether it may be removed now: not while something plays, nor without the right to test. */
  removable: boolean;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onViewServerRun: (id: string) => void;
};

const DEVICES = [
  { upTo: 480, label: 'Phone', icon: 'fa-solid fa-mobile-screen' },
  { upTo: 1024, label: 'Tablet', icon: 'fa-solid fa-tablet-screen-button' },
  { upTo: Infinity, label: 'Desktop', icon: 'fa-solid fa-desktop' }
] as const;

const deviceOf = (width = 1440) => DEVICES.find(each => width <= each.upTo) ?? DEVICES[2];

/**
 * A journey in the list: its letter, what it checks (two lines at most), where and as whom it plays and what it does
 * first, its tags, and where it stands. Removing it is offered in its pill's place while the row is hovered or
 * focused — no column kept empty for a button that is hidden.
 */
const FlowRow = ({
  journey,
  letter,
  firstLine,
  state,
  chosen,
  unsaved,
  tag,
  problems,
  onServer,
  selectable,
  removable,
  onSelect,
  onRemove,
  onViewServerRun
}: FlowRowProps) => {
  const playing = state.state === 'playing';
  const device = deviceOf(journey.width);

  return (
    <li
      className={clsx(
        'group relative flex gap-2.5 border-b border-gray-200 py-2 pr-2.5 pl-3 last:border-b-0 dark:border-zinc-800',
        {
          'bg-primary-50 before:bg-primary-500 dark:bg-primary-400/10 before:absolute before:inset-y-0 before:left-0 before:w-0.5':
            chosen,
          'cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/60': !chosen && selectable
        }
      )}
      onClick={chosen || !selectable ? undefined : () => onSelect(journey.id)}
    >
      <span
        className={clsx(
          'mt-px flex size-6 shrink-0 items-center justify-center rounded-md border text-[11px] font-semibold',
          {
            'border-primary-ui bg-primary-500 text-white': playing,
            'border-primary-ui text-primary-700 dark:text-primary-200': chosen && !playing,
            'border-gray-300 text-zinc-500 dark:border-zinc-600 dark:text-zinc-400': !chosen && !playing
          }
        )}
      >
        {letter}
      </span>
      <div className="flex min-w-0 grow flex-col gap-0.5">
        <span className="flex min-w-0 items-start gap-1.5 text-[13px] leading-snug font-medium text-zinc-900 dark:text-zinc-100">
          <NeedsLook problems={problems} />
          <span className="line-clamp-2 min-w-0">
            {journey.title || 'A new journey'}
            {unsaved && <span className="text-primary-text font-normal"> · not saved</span>}
          </span>
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
          <i className={clsx(device.icon, 'w-3 shrink-0 text-center text-[10px]')} title={device.label} />
          {journey.as && (
            <span className="flex shrink-0 items-center gap-1" title={`Plays as the test account ${journey.as}`}>
              <i className="fa-solid fa-user text-[9px]" />
              {journey.as}
              <span aria-hidden="true">·</span>
            </span>
          )}
          <span className="min-w-0 truncate font-mono">{firstLine}</span>
        </span>
        {journey.tags && journey.tags.length > 0 && (
          <span className="mt-0.5 flex min-w-0 flex-wrap gap-1">
            {journey.tags.map(each => (
              <span
                key={each}
                className={clsx('rounded-full border px-1.5 text-[10px] leading-4', {
                  'border-primary-400 text-primary-700 dark:text-primary-200': each === tag,
                  'border-gray-200 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400': each !== tag
                })}
              >
                {each}
              </span>
            ))}
          </span>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="grid justify-items-end">
          <StatePill
            state={state}
            steps={journey.steps.length}
            className={clsx('col-start-1 row-start-1', {
              'group-focus-within:invisible group-hover:invisible': removable
            })}
          />
          {removable && (
            <button
              type="button"
              title="Remove this journey"
              aria-label={`Remove ${journey.title || journey.id}`}
              className="invisible col-start-1 row-start-1 flex h-5 cursor-pointer items-center gap-1 rounded px-1.5 text-[11px] text-zinc-500 group-focus-within:visible group-hover:visible hover:bg-red-50 hover:text-red-600 dark:text-zinc-400 dark:hover:bg-red-500/10 dark:hover:text-red-400"
              onClick={event => {
                event.stopPropagation();
                onRemove(journey.id);
              }}
            >
              <i className="fa-solid fa-trash text-[10px]" />
              Remove
            </button>
          )}
        </span>
        {onServer && (
          <button
            type="button"
            title={onServer.ok ? 'Passed on the server: view the run' : 'Failed on the server: view the run'}
            className={clsx(
              'flex h-5 cursor-pointer items-center gap-1 rounded px-1 text-[10px] font-medium hover:bg-gray-100 dark:hover:bg-zinc-800',
              onServer.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
            )}
            onClick={event => {
              event.stopPropagation();
              onViewServerRun(journey.id);
            }}
          >
            <i className="fa-solid fa-server" />
            Server
          </button>
        )}
      </div>
    </li>
  );
};

export default FlowRow;
