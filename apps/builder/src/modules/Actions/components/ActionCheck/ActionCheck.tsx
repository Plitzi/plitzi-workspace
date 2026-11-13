import Button from '@plitzi/plitzi-ui/Button';
import { useCallback } from 'react';

import Notice from '@pmodules/App/components/Notice';
import useGraphQL from '@pmodules/Network/hooks/useGraphQL';

export type ActionCheckProps = {
  actionId?: string;
};

/** The step id out of a `nodes.<id>.params.<field>` path. */
const stepOf = (path: string) => path.split('.')[1] ?? '';

const ActionCheck = ({ actionId = '' }: ActionCheckProps) => {
  const { data, isLoading, mutate } = useGraphQL(actionId ? 'SpaceCheckAction' : null, data => data?.SpaceCheckAction, {
    identifier: actionId
  });

  const handleRecheck = useCallback(() => void mutate(), [mutate]);

  if (!actionId) {
    return null;
  }

  const issues = data?.issues ?? [];
  const errors = issues.filter(issue => issue.level === 'error');

  return (
    <div className="border-ui-line flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Check against this server</span>
        <Button size="xs" disabled={isLoading} onClick={handleRecheck}>
          {isLoading ? 'Checking…' : 'Re-check'}
        </Button>
      </div>
      {!data && !isLoading && (
        <span className="text-ui-fg-subtle text-xs">
          Nothing checked yet — the answer arrives with the saved action.
        </span>
      )}
      {data && issues.length === 0 && (
        <Notice tone="success">
          <span className="text-xs">
            Every task, credential, connector and schedule this flow names is available on this server. It can still
            fail on what only a real run reaches — a provider that is down, a statement that is wrong — but nothing
            about its configuration is missing.
          </span>
        </Notice>
      )}
      {issues.map(issue => (
        <Notice key={`${issue.path}-${issue.message}`} tone={issue.level === 'error' ? 'danger' : 'caution'}>
          <div className="flex flex-col text-xs">
            <span>
              {stepOf(issue.path) && <b>{stepOf(issue.path)}: </b>}
              {issue.message}
            </span>
            {issue.hint && <span className="opacity-80">{issue.hint}</span>}
          </div>
        </Notice>
      ))}
      {errors.length > 0 && (
        <span className="text-ui-fg-subtle text-xs">
          A run started by a page, a webhook or a schedule will fail on these until they are fixed.
        </span>
      )}
    </div>
  );
};

export default ActionCheck;
