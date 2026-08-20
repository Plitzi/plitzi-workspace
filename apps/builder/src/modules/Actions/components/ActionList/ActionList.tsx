import Button from '@plitzi/plitzi-ui/Button';
import Heading from '@plitzi/plitzi-ui/Heading';
import { useCallback } from 'react';

import type { SpaceAction } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

export type ActionListProps = {
  actions: SpaceAction[];
  onSelect: (identifier: string) => void;
  onRemove: (identifier: string) => void;
  onCreate: () => void;
};

/** What each action is reachable BY, at a glance: a flow nobody can trigger is the commonest way to lose an hour. */
const triggerSummary = (action: SpaceAction) =>
  action.document.triggers.map(trigger => trigger.type).join(', ') || 'no triggers';

const ActionList = ({ actions, onSelect, onRemove, onCreate }: ActionListProps) => {
  const handleSelect = useCallback((identifier: string) => () => onSelect(identifier), [onSelect]);

  const handleRemove = useCallback(
    (identifier: string) => (e: MouseEvent) => {
      e.stopPropagation();
      onRemove(identifier);
    },
    [onRemove]
  );

  return (
    <div className="mx-auto flex w-full max-w-4xl grow basis-0 flex-col p-4">
      <div className="mb-4 flex w-full items-center justify-between">
        <Heading as="h5">Server Actions</Heading>
        <Button size="sm" onClick={onCreate}>
          New Action
        </Button>
      </div>
      {actions.length === 0 && (
        <div className="rounded-sm border-2 border-dashed border-gray-300 p-4 text-center text-sm text-zinc-600 dark:border-zinc-600 dark:text-zinc-400">
          Work a page cannot do in the browser: charge a card, send an email, read a system only the server can reach.
          The credentials never leave the server.
        </div>
      )}
      <div className="flex flex-col gap-2 overflow-auto">
        {actions.map(action => (
          <div
            key={action.identifier}
            className="flex cursor-pointer items-center justify-between rounded-sm border border-gray-300 p-2 dark:border-zinc-600"
            onClick={handleSelect(action.identifier)}
          >
            <div className="flex flex-col">
              <span className="text-sm font-medium">
                {action.name}
                {!action.enabled && <span className="ml-2 text-xs text-amber-600">disabled</span>}
              </span>
              <span className="text-xs text-gray-500">{triggerSummary(action)}</span>
            </div>
            <Button size="xs" onClick={handleRemove(action.identifier)} title="Remove action">
              <Button.Icon icon="fa-solid fa-trash" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ActionList;
