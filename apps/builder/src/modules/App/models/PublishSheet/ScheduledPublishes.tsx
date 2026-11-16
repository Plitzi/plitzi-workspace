import Button from '@plitzi/plitzi-ui/Button';
import clsx from 'clsx';
import { useCallback } from 'react';

import useBuilderNetwork from '@pmodules/Network/hooks/useBuilderNetwork';
import useGraphQL from '@pmodules/Network/hooks/useGraphQL';

import { revisionName } from '../../helpers/environments';

import type { SpaceScheduledPublish } from '@plitzi/sdk-shared';

const listOf = (response: { SpaceScheduledPublishes: SpaceScheduledPublish[] } | undefined) =>
  response?.SpaceScheduledPublishes;

/** A moment as the person reads it, in their own time, with UTC beside it — what the platform keeps. */
export const momentWords = (at: number): string => {
  const date = new Date(at * 1000);

  return `${date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} (${date.toISOString().slice(11, 16)} UTC)`;
};

const STATUS_WORDS: Record<SpaceScheduledPublish['status'], string> = {
  pending: 'Set',
  published: 'Published',
  failed: 'Not published',
  canceled: 'Called off'
};

/** The space's publishes set for later on one domain — each with when, what and who — and a way to call one off. */
const ScheduledPublishes = ({ domain }: { domain: string }) => {
  const { mutate } = useBuilderNetwork();
  const { data = [], mutate: refresh } = useGraphQL('SpaceScheduledPublishes', listOf, undefined, {
    revalidateOnMount: true
  });
  const mine = data.filter(each => each.domain === domain);
  const handleCancel = useCallback(
    async (id: number) => {
      await mutate('SpaceCancelScheduledPublish', { id }, true);
      await refresh();
    },
    [mutate, refresh]
  );

  if (mine.length === 0) {
    return null;
  }

  return (
    <section aria-label="Set for later" className="flex flex-col gap-1 text-xs">
      <span className="text-ui-fg-subtle text-[11px] font-bold tracking-wider uppercase">Set for later</span>
      {mine.map(each => (
        <div key={each.id} className="flex items-center gap-2 rounded-md px-2 py-1.5">
          <span className="flex min-w-0 grow flex-col">
            <span className="text-ui-fg truncate">
              {revisionName(each.environment, each.revision)} at {momentWords(each.at)}
            </span>
            <span
              className={clsx(
                'truncate',
                each.status === 'failed' ? 'text-red-700 dark:text-red-300' : 'text-ui-fg-subtle'
              )}
            >
              {[STATUS_WORDS[each.status], each.by?.username, each.error].filter(Boolean).join(' · ')}
            </span>
          </span>
          {each.status === 'pending' && (
            <Button size="xs" intent="secondary" onClick={() => void handleCancel(each.id)}>
              Call off
            </Button>
          )}
        </div>
      ))}
    </section>
  );
};

export default ScheduledPublishes;
