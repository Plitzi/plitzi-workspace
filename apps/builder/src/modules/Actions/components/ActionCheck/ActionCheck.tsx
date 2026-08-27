import Alert from '@plitzi/plitzi-ui/Alert';
import Button from '@plitzi/plitzi-ui/Button';
import { useCallback } from 'react';

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
    <div className="flex flex-col gap-2 rounded-sm border border-gray-300 p-3 dark:border-zinc-600">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Check against this server</span>
        <Button size="xs" disabled={isLoading} onClick={handleRecheck}>
          {isLoading ? 'Checking…' : 'Re-check'}
        </Button>
      </div>
      {!data && !isLoading && (
        <span className="text-xs text-gray-500 dark:text-zinc-400">
          Nothing checked yet — the answer arrives with the saved action.
        </span>
      )}
      {data && issues.length === 0 && (
        <Alert intent="success" size="sm">
          <span className="text-xs">
            Every task, credential, connector and schedule this flow names is available on this server. It can still
            fail on what only a real run reaches — a provider that is down, a statement that is wrong — but nothing
            about its configuration is missing.
          </span>
        </Alert>
      )}
      {issues.map(issue => (
        <Alert key={`${issue.path}-${issue.message}`} intent={issue.level === 'error' ? 'error' : 'warning'} size="sm">
          <div className="flex flex-col text-xs">
            <span>
              {stepOf(issue.path) && <b>{stepOf(issue.path)}: </b>}
              {issue.message}
            </span>
            {issue.hint && <span className="opacity-80">{issue.hint}</span>}
          </div>
        </Alert>
      ))}
      {errors.length > 0 && (
        <span className="text-xs text-gray-500 dark:text-zinc-400">
          A run started by a page, a webhook or a schedule will fail on these until they are fixed.
        </span>
      )}
    </div>
  );
};

export default ActionCheck;
