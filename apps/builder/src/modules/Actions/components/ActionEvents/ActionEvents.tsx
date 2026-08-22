import Button from '@plitzi/plitzi-ui/Button';
import clsx from 'clsx';
import { useCallback } from 'react';

import useGraphQL from '@pmodules/Network/hooks/useGraphQL';

import type { ActionEvent } from '@plitzi/sdk-shared';

export type ActionEventsProps = {
  /** Empty while an action is being created: there is nothing to have a history yet. */
  actionId?: string;
};

const emptyEvents: ActionEvent[] = [];

/** Local time, to the minute. A run history is read against "when did I change that", which is a wall clock. */
const when = (createdAt: number) => new Date(createdAt * 1000).toLocaleString();

const toneOf = (event: ActionEvent) => {
  if (event.refused) {
    return 'text-amber-700 dark:text-amber-400';
  }

  return event.status === 'completed' ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400';
};

/**
 * What has actually happened to this action.
 *
 * The test-run panel above answers "does it work when I press the button". This answers the question nobody could
 * ask before: what happened when NOBODY pressed anything — the webhook that arrived at 4am, the schedule that
 * fired, the delivery that was turned away for a signature that does not match. Those have no browser tab to
 * report into, and until they showed up here the honest answer to "is my integration working" was a shrug.
 */
const ActionEvents = ({ actionId = '' }: ActionEventsProps) => {
  const {
    data = emptyEvents,
    isLoading,
    mutate
  } = useGraphQL(actionId ? 'SpaceActionEvents' : null, data => data?.SpaceActionEvents.edges, {
    actionId,
    pageSize: 20
  });

  const handleRefresh = useCallback(() => void mutate(), [mutate]);

  if (!actionId) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 rounded-sm border border-gray-300 p-3 dark:border-zinc-600">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Recent activity</span>
        <Button size="xs" disabled={isLoading} onClick={handleRefresh}>
          {isLoading ? 'Loading…' : 'Refresh'}
        </Button>
      </div>
      {data.length === 0 && (
        <span className="text-xs text-gray-500 dark:text-zinc-400">
          Nothing yet. A run started by a page, a webhook or a schedule shows up here — including the deliveries that
          were refused before anything ran.
        </span>
      )}
      {data.map(event => (
        <div
          key={event.id}
          className="flex flex-col rounded-sm border border-gray-200 px-2 py-1 text-xs dark:border-zinc-700"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-gray-500 dark:text-zinc-400">
              {when(event.createdAt)} · {event.trigger}
            </span>
            <span className={clsx('font-medium', toneOf(event))}>{event.refused ? event.reason : event.status}</span>
          </div>
          {/* The steps only when they say something a status does not: a run that worked is its output, a run
              that stopped is the step it stopped at. */}
          {!event.refused && event.status !== 'completed' && event.steps.length > 0 && (
            <span className="mt-1 break-words text-gray-500 dark:text-zinc-400">{event.steps.join(' → ')}</span>
          )}
          {event.detail && <span className="mt-1 break-words text-gray-600 dark:text-zinc-300">{event.detail}</span>}
        </div>
      ))}
    </div>
  );
};

export default ActionEvents;
