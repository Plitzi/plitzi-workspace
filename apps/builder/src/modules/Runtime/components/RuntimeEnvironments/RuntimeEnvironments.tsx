import Alert from '@plitzi/plitzi-ui/Alert';
import Badge from '@plitzi/plitzi-ui/Badge';
import Button from '@plitzi/plitzi-ui/Button';
import Heading from '@plitzi/plitzi-ui/Heading';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { use, useCallback } from 'react';

import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';

import RuntimeSize from '../RuntimeSize';

import type {
  BuilderMutationsMap,
  BuilderQueriesMap,
  SpaceRuntimeEnvironment,
  SpaceRuntimeSizeOption
} from '@plitzi/sdk-shared';
import type { BuilderNetworkContextValue } from '@plitzi/sdk-shared/network/NetworkContext';

export type RuntimeEnvironmentsProps = {
  environments: SpaceRuntimeEnvironment[];
  /** Every size there is, and which the space's plan includes. */
  sizes: SpaceRuntimeSizeOption[];
  /** Asked once something changed, to read the runtime again. */
  onChange: () => Promise<void>;
};

const STATUS: Record<
  SpaceRuntimeEnvironment['status'],
  { label: string; intent: 'success' | 'info' | 'error' | 'default' }
> = {
  ready: { label: 'Running', intent: 'success' },
  starting: { label: 'Starting', intent: 'info' },
  waiting: { label: 'Waiting to start', intent: 'default' },
  failed: { label: 'Not running', intent: 'error' }
};

/**
 * When it last started, as the clock on this wall reads it: to the second, because a restart on a laptop takes less than
 * one — a new time is how a restart is seen at all.
 */
const clockOf = (seconds: number): string => new Date(seconds * 1000).toLocaleTimeString();

/** Every environment's runtime: which code, how it is, and what it serves — and taking the runtime away. */
const RuntimeEnvironments = ({ environments, sizes, onChange }: RuntimeEnvironmentsProps) => {
  const { mutate: mutateNetwork } = use(NetworkContext) as BuilderNetworkContextValue<
    BuilderQueriesMap,
    BuilderMutationsMap
  >;
  const { showDialog } = useModal();

  const handleRemove = useCallback(async () => {
    const confirmed = await showDialog(
      <Modal.Header>
        <h4>Remove the runtime</h4>
      </Modal.Header>,
      <Modal.Body>
        <div className="px-3 py-2">
          <h4>Every environment stops running the space’s own code, and its tasks stop answering. Remove it?</h4>
        </div>
      </Modal.Body>
    );
    if (!confirmed) {
      return;
    }

    const response = await mutateNetwork('SpaceRemoveRuntime', {});
    if (response.success) {
      await onChange();
    }
  }, [mutateNetwork, onChange, showDialog]);

  return (
    <div className="flex flex-col gap-3">
      <Heading as="h6">Environments</Heading>
      {environments.map(runtime => (
        <div
          key={runtime.environment}
          className="flex flex-col gap-2 rounded-sm border border-gray-200 px-3 py-2 dark:border-zinc-700"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-col">
              <span className="text-sm font-medium">{runtime.environment}</span>
              <span className="truncate text-xs text-gray-500 dark:text-zinc-400">
                {runtime.revision === 0 && 'The draft'}
                {runtime.revision > 0 && `Revision ${String(runtime.revision)}`} · code {runtime.digest.slice(0, 12)}
              </span>
            </div>
            <Badge intent={STATUS[runtime.status].intent} size="xs" solid={false}>
              {STATUS[runtime.status].label}
            </Badge>
          </div>
          <RuntimeSize environment={runtime.environment} size={runtime.size} sizes={sizes} onChange={onChange} />
          {runtime.error && (
            <Alert intent="error" size="xs" solid={false}>
              {runtime.error}
            </Alert>
          )}
          {runtime.status === 'ready' && (
            <span className="text-xs text-gray-500 dark:text-zinc-400">
              {runtime.tasks.length} tasks
              {runtime.endpoints.length > 0 && ` · answers ${runtime.endpoints.join(', ')}`}
              {runtime.startedAt !== null && ` · started ${clockOf(runtime.startedAt)}`}
            </span>
          )}
        </div>
      ))}
      <div>
        <Button size="sm" intent="danger" onClick={handleRemove}>
          Remove runtime
        </Button>
      </div>
    </div>
  );
};

export default RuntimeEnvironments;
