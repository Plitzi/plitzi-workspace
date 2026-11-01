import clsx from 'clsx';
import { use, useMemo } from 'react';

import { useBuilderStore } from '@plitzi/sdk-shared/store';
import EmptyState from '@pmodules/App/components/EmptyState';
import Notice from '@pmodules/App/components/Notice';
import PanelSearch from '@pmodules/App/components/PanelSearch';
import PanelToolbar from '@pmodules/App/components/PanelToolbar';
import useSpaceEntitlements from '@pmodules/Space/hooks/useSpaceEntitlements';

import FlowRow from './components/FlowRow';
import TagFilter from './components/TagFilter';
import { elementNameOf, journeyMatches, problemsOfTest, tagsOf } from '../../helpers';
import useMayTest from '../../hooks/useMayTest';
import { sentenceText } from '../../studio/sentences';
import TestStudioContext from '../../studio/TestStudioContext';

import type { JourneyFilter } from '../../helpers';
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
  /** What the list is narrowed to — the words searched for and a tag; Play all plays the same. */
  filter: JourneyFilter;
  onFilter: (filter: JourneyFilter) => void;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRemove: (id: string) => void;
  onViewServerRun: (id: string) => void;
};

/** What a flow does first, in words: its first action — what a person reads a flow by. */
const firstLineOf = (flow: E2eTest, nameOf: (target: string) => string): string => {
  const first = flow.steps.find(step => !step.kind.startsWith('expect')) ?? flow.steps.at(0);

  return first ? sentenceText(first, nameOf) : 'No steps yet';
};

/**
 * The space's journeys: how many, a search and the way to add one, the tags to narrow them by, and a row each — the
 * chosen one lit, played on the page on the left when it is chosen. The list takes the room the column has; the tags
 * keep to one row however many there are.
 */
const FlowList = ({
  serverRun,
  serverPlay,
  problems,
  filter,
  onFilter,
  onSelect,
  onCreate,
  onRemove,
  onViewServerRun
}: FlowListProps) => {
  const { tests, flow, dirty, states, mode } = use(TestStudioContext);
  const [flat] = useBuilderStore('schema.flat');
  const flows = useMemo(() => tests.e2e ?? [], [tests]);
  // A flow not saved yet is in the list too, at its end: it is the one being written.
  const all = useMemo(
    () => (flow && !flows.some(each => each.id === flow.id) ? [...flows, flow] : flows),
    [flow, flows]
  );
  const tags = useMemo(() => tagsOf(all), [all]);
  // Narrowed, the one chosen stays in the list: it is the one being read and edited.
  const shown = all.filter(each => each.id === flow?.id || journeyMatches(each, filter));
  const narrowed = filter.query.trim() !== '' || filter.tag !== undefined;
  const live = mode === 'playing';
  const nameOf = (target: string) => elementNameOf(flat, target);
  const { entitlements } = useSpaceEntitlements();
  const limit = entitlements?.journeysPerSpace ?? null;
  // At the plan's number a new journey would be refused on saving: it is not offered. Those kept stay editable.
  const full = limit !== null && all.length >= limit;
  const more = entitlements?.moreJourneys;
  const { mayTest } = useMayTest();

  return (
    <section className="flex min-h-56 grow flex-col gap-2" aria-label="Journeys">
      <div className="flex items-center gap-2">
        <h3 className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
          Journeys
        </h3>
        <span className="rounded-full bg-gray-100 px-1.5 text-[11px] font-semibold text-zinc-600 tabular-nums dark:bg-zinc-800 dark:text-zinc-300">
          {narrowed ? `${String(shown.length)} of ${String(all.length)}` : all.length}
          {!narrowed && limit !== null && ` / ${String(limit)}`}
        </span>
        {live && (
          <span className="ml-auto flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-red-600 uppercase dark:text-red-400">
            <span className="size-1.5 animate-pulse rounded-full bg-red-500" />
            Live
          </span>
        )}
      </div>
      <PanelToolbar
        action={{
          label: 'New journey',
          onClick: onCreate,
          disabled: live || full || !mayTest,
          ...(full ? { title: 'The plan keeps no more journeys in this space' } : {})
        }}
      >
        <PanelSearch
          value={filter.query}
          placeholder="Search journeys"
          onChange={query => onFilter({ ...filter, query })}
        />
      </PanelToolbar>
      {tags.length > 0 && <TagFilter tags={tags} tag={filter.tag} onTag={tag => onFilter({ ...filter, tag })} />}
      {full && entitlements && (
        <Notice tone="caution" link={more ? { label: 'See the plans', href: more.upgradeUrl } : undefined}>
          The {entitlements.tierLabel} plan keeps {limit} {limit === 1 ? 'journey' : 'journeys'} per space — yours keep
          playing and can be changed.
          {more && ` ${more.requires} keeps ${more.allows === null ? 'as many as you like' : String(more.allows)}.`}
        </Notice>
      )}
      {all.length === 0 ? (
        <EmptyState
          size="panel"
          icon="fa-solid fa-route"
          title="No journeys yet"
          description="A journey is what a visitor does on the page, from start to end, and what must show as they go."
        />
      ) : (
        <ol
          className={clsx(
            'flex min-h-0 grow flex-col overflow-y-auto rounded-lg border border-gray-300 dark:border-zinc-700',
            { 'justify-center': shown.length === 0 }
          )}
        >
          {shown.length === 0 && (
            <li className="px-4 py-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
              No journey matches — clear the search, or choose All.
            </li>
          )}
          {shown.map(each => {
            const chosen = flow?.id === each.id;
            const current = chosen ? flow : each;
            // While the server plays them, a journey it has not reached yet waits for it — not what the canvas last said.
            const state: FlowState = serverPlay
              ? (serverPlay.journeys[each.id] ?? { state: 'queued' })
              : (states[each.id] ?? { state: 'idle' });
            const onServer = serverRun?.results.find(result => result.id === each.id);

            return (
              <FlowRow
                key={each.id}
                journey={current}
                letter={String.fromCharCode(65 + (all.indexOf(each) % 26))}
                firstLine={firstLineOf(current, nameOf)}
                state={state}
                chosen={chosen}
                unsaved={chosen && dirty}
                tag={filter.tag}
                problems={problemsOfTest(problems, 'e2e', each.id)}
                {...(onServer ? { onServer } : {})}
                selectable={!live}
                removable={!live && mayTest}
                onSelect={onSelect}
                onRemove={onRemove}
                onViewServerRun={onViewServerRun}
              />
            );
          })}
        </ol>
      )}
    </section>
  );
};

export default FlowList;
