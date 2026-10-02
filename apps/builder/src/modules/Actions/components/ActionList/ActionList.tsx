import Button from '@plitzi/plitzi-ui/Button';

import { actionTriggers, isActionEnabled } from '@plitzi/sdk-shared/actions';
import EmptyState from '@pmodules/App/components/EmptyState';
import ResourceRow from '@pmodules/App/components/ResourceRow';
import ViewPage from '@pmodules/App/components/ViewPage';

import type { SpaceAction } from '@plitzi/sdk-shared';

export type ActionListProps = {
  actions: SpaceAction[];
  onSelect: (identifier: string) => void;
  onRemove: (identifier: string) => void;
  onCreate: () => void;
};

const DESCRIPTION =
  'Work a page cannot do in the browser: charge a card, send an email, read a system only the server can reach. The credentials never leave the server.';

const triggerSummary = (action: SpaceAction) =>
  actionTriggers(action.document)
    .map(node => node.action)
    .join(', ') || 'no triggers';

const ActionList = ({ actions, onSelect, onRemove, onCreate }: ActionListProps) => {
  const createButton = (
    <Button size="sm" onClick={onCreate} iconPlacement="before">
      <Button.Icon icon="fa-solid fa-plus" />
      New Action
    </Button>
  );

  return (
    <ViewPage description={actions.length > 0 ? DESCRIPTION : undefined} actions={actions.length > 0 && createButton}>
      {actions.length === 0 && (
        <EmptyState
          icon="fa-solid fa-bolt"
          title="No server actions yet"
          description={DESCRIPTION}
          action={createButton}
        />
      )}
      {actions.length > 0 && (
        <div className="flex flex-col gap-2">
          {actions.map(action => (
            <ResourceRow
              key={action.identifier}
              id={action.identifier}
              icon="fa-solid fa-bolt"
              title={action.name}
              subtitle={triggerSummary(action)}
              badge={
                !isActionEnabled(action.document) && (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                    Disabled
                  </span>
                )
              }
              removeTitle="Remove action"
              onSelect={onSelect}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}
    </ViewPage>
  );
};

export default ActionList;
