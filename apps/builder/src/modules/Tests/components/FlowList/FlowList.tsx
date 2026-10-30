import Button from '@plitzi/plitzi-ui/Button';
import clsx from 'clsx';
import { use } from 'react';

import { useBuilderStore } from '@plitzi/sdk-shared/store';
import useSpaceEntitlements from '@pmodules/Space/hooks/useSpaceEntitlements';

import { elementNameOf, problemsOfTest } from '../../helpers';
import { sentenceText } from '../../studio/sentences';
import TestStudioContext from '../../studio/TestStudioContext';
import CalmNote from '../CalmNote';
import NeedsLook from '../NeedsLook';

import type { ServerPlay } from '../../hooks/useServerPlay';
import type { FlowState } from '../../studio/TestStudioContext';
import type { E2eTest } from '@plitzi/sdk-shared';
import type { TSpaceRunE2eTestsMutation } from '@plitzi/sdk-shared/network';

export type FlowListProps = {
  /** The flows as the server last played them, when it did. */
  serverRun?: TSpaceRunE2eTestsMutation;
  /** The journeys the server is playing now: their pills say how far each got there. */
  serverPlay?: ServerPlay;
  /** What the server said is wrong with the tests as written: a flow it names is marked. */
  problems: readonly string[];
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRemove: (id: string) => void;
  onViewServerRun: (id: string) => void;
};

const DEVICE = (width = 1440) => (width <= 480 ? 'Phone' : width <= 1024 ? 'Tablet' : 'Desktop');

const PILL =
  'shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide whitespace-nowrap uppercase';

/** Where a flow stands, as a pill: waiting, playing and how far, passing, failing, or one only the server plays. */
const Pill = ({ state, steps }: { state: FlowState; steps: number }) => {
  switch (state.state) {
    case 'queued':
      return (
        <span className={clsx(PILL, 'border-dashed border-gray-300 text-zinc-500 dark:border-zinc-600')}>Queued</span>
      );
    case 'playing':
      return (
        <span className={clsx(PILL, 'border-primary-400 text-primary-700 dark:text-primary-200 border-dashed')}>
          Playing {state.played}/{steps}
        </span>
      );
    case 'passed':
      return (
        <span
          className={clsx(
            PILL,
            'border-emerald-500 bg-emerald-500 text-white dark:border-emerald-400 dark:bg-emerald-400 dark:text-emerald-950'
          )}
        >
          Passes
        </span>
      );
    case 'failed':
      return (
        <span
          className={clsx(
            PILL,
            'border-red-500 bg-red-500 text-white dark:border-red-400 dark:bg-red-400 dark:text-red-950'
          )}
        >
          Fails
        </span>
      );
    case 'stopped':
      return <span className={clsx(PILL, 'border-gray-300 text-zinc-500 dark:border-zinc-600')}>Stopped</span>;
    case 'server':
      return (
        <span className={clsx(PILL, 'border-amber-400 text-amber-700 dark:text-amber-300')} title={state.why}>
          On the server
        </span>
      );
    case 'idle':
      return (
        <span className={clsx(PILL, 'border-dashed border-gray-300 text-zinc-400 dark:border-zinc-700')}>Ready</span>
      );
  }
};

/** What a flow does first, in words: its first action — what a person reads a flow by. */
const firstLineOf = (flow: E2eTest, nameOf: (target: string) => string): string => {
  const first = flow.steps.find(step => !step.kind.startsWith('expect')) ?? flow.steps.at(0);

  return first ? sentenceText(first, nameOf) : 'No steps yet';
};

/**
 * The space's flows, each a row: its letter, what it is, what it does first and where it stands — the chosen one lit,
 * played on the page on the left when it is chosen.
 */
const FlowList = ({
  serverRun,
  serverPlay,
  problems,
  onSelect,
  onCreate,
  onRemove,
  onViewServerRun
}: FlowListProps) => {
  const { tests, flow, dirty, states, mode, playingAll } = use(TestStudioContext);
  const [flat] = useBuilderStore('schema.flat');
  const flows = tests.e2e ?? [];
  // A flow not saved yet is in the list too, at its end: it is the one being written.
  const shown = flow && !flows.some(each => each.id === flow.id) ? [...flows, flow] : flows;
  const live = mode === 'playing';
  const nameOf = (target: string) => elementNameOf(flat, target);
  const { entitlements } = useSpaceEntitlements();
  const limit = entitlements?.journeysPerSpace ?? null;
  // At the plan's number a new journey would be refused on saving: it is not offered. Those kept stay editable.
  const full = limit !== null && shown.length >= limit;
  const more = entitlements?.moreJourneys;

  return (
    <section className="flex min-h-0 flex-col gap-2" aria-label="Journeys">
      <div className="flex items-center gap-3">
        <span className="grow text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
          Journeys · {shown.length}
          {limit !== null && ` of ${String(limit)}`}
        </span>
        <span
          className={clsx('flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase', {
            'text-red-600 dark:text-red-400': live,
            'text-zinc-400 dark:text-zinc-500': !live
          })}
        >
          <span className={clsx('size-1.5 rounded-full', { 'animate-pulse bg-red-500': live, 'bg-zinc-400': !live })} />
          {live ? 'Live' : 'Idle'}
        </span>
        <Button
          size="xs"
          intent="secondary"
          iconPlacement="before"
          disabled={live || full}
          title={full ? 'The plan keeps no more journeys in this space' : undefined}
          onClick={onCreate}
        >
          <Button.Icon icon="fa-solid fa-plus" />
          New journey
        </Button>
      </div>
      {full && entitlements && (
        <CalmNote link={more ? { label: 'See the plans', href: more.upgradeUrl } : undefined}>
          The {entitlements.tierLabel} plan keeps {limit} {limit === 1 ? 'journey' : 'journeys'} per space — yours keep
          playing and can be changed.
          {more && ` ${more.requires} keeps ${more.allows === null ? 'as many as you like' : String(more.allows)}.`}
        </CalmNote>
      )}
      <ol className="flex min-h-0 flex-col overflow-y-auto rounded-lg border border-gray-300 dark:border-zinc-700">
        {shown.map((each, index) => {
          const chosen = flow?.id === each.id;
          const current = chosen ? flow : each;
          const state = serverPlay?.journeys[each.id] ?? states[each.id] ?? { state: 'idle' };
          const onServer = serverRun?.results.find(result => result.id === each.id);
          const playing = state.state === 'playing';

          return (
            <li
              key={each.id}
              className={clsx(
                'group flex items-center gap-3 border-b border-gray-300 px-3 py-2.5 last:border-b-0 dark:border-zinc-700',
                {
                  'bg-primary-50 dark:bg-primary-400/10': chosen,
                  'cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/70': !chosen && !(live && playingAll)
                }
              )}
              onClick={chosen || live ? undefined : () => onSelect(each.id)}
            >
              <span
                className={clsx(
                  'flex size-8 shrink-0 items-center justify-center rounded-md border text-xs font-semibold',
                  {
                    'border-primary-ui bg-primary-500 text-white': playing,
                    'border-primary-ui text-primary-700 dark:text-primary-200': chosen && !playing,
                    'border-gray-300 text-zinc-600 dark:border-zinc-600 dark:text-zinc-300': !chosen && !playing
                  }
                )}
              >
                {String.fromCharCode(65 + (index % 26))}
              </span>
              <div className="flex min-w-0 grow flex-col">
                <span className="flex min-w-0 items-center gap-1.5 truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  <NeedsLook problems={problemsOfTest(problems, 'e2e', each.id)} />
                  {current.title || 'A new journey'}
                  {chosen && dirty && <span className="text-primary-text"> · not saved</span>}
                </span>
                <span className="truncate font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                  “{firstLineOf(current, nameOf)}” · {DEVICE(current.width)}
                </span>
              </div>
              {onServer && (
                <Button
                  size="xs"
                  intent="secondary"
                  title={onServer.ok ? 'Passed on the server: view the run' : 'Failed on the server: view the run'}
                  onClick={event => {
                    event.stopPropagation();
                    onViewServerRun(each.id);
                  }}
                >
                  <i
                    className={clsx('fa-solid', {
                      'fa-server text-emerald-600': onServer.ok,
                      'fa-server text-red-600': !onServer.ok
                    })}
                  />
                </Button>
              )}
              <Pill state={state} steps={current.steps.length} />
              {!live && (
                <button
                  type="button"
                  title="Remove this journey"
                  className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded text-[11px] text-zinc-400 opacity-0 group-hover:opacity-100 hover:bg-gray-200 hover:text-red-600 dark:hover:bg-zinc-700"
                  onClick={event => {
                    event.stopPropagation();
                    onRemove(each.id);
                  }}
                >
                  <i className="fa-solid fa-trash" />
                </button>
              )}
            </li>
          );
        })}
        {shown.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
            No journeys yet. A journey is what a visitor does on the page, from start to end, and what must show as they
            go.
          </li>
        )}
      </ol>
    </section>
  );
};

export default FlowList;
