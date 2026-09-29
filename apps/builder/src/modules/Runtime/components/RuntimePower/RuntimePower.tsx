import Button from '@plitzi/plitzi-ui/Button';
import { use, useCallback, useState } from 'react';

import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';

import idleDurationOf from '../../helpers/idleDurationOf';
import stopMomentOf from '../../helpers/stopMomentOf';

import type { BuilderMutationsMap, BuilderQueriesMap, SpaceRuntimeEnvironment } from '@plitzi/sdk-shared';
import type { BuilderNetworkContextValue } from '@plitzi/sdk-shared/network/NetworkContext';

export type RuntimePowerProps = {
  runtime: SpaceRuntimeEnvironment;
  /** How long a runtime may go unused before it is stopped; 0 when the platform never stops one. */
  idleMinutes: number;
  /** Asked once it was started or stopped, to read the runtime again. */
  onChange: () => Promise<void>;
};

/**
 * Starting and stopping an environment's runtime — the buttons held while a request is on its way and while the runtime
 * is starting or stopping, which its status says — and saying when it stops by itself: a runtime nobody uses for a while
 * is stopped so it spends nothing, and stays stopped until somebody starts it again, here or with a push or a publish.
 */
const RuntimePower = ({ runtime, idleMinutes, onChange }: RuntimePowerProps) => {
  const { mutate: mutateNetwork } = use(NetworkContext) as BuilderNetworkContextValue<
    BuilderQueriesMap,
    BuilderMutationsMap
  >;
  // Only while the request is on its way: what follows it — starting, stopping — is the runtime's status to say.
  const [asking, setAsking] = useState(false);
  const passing = runtime.status === 'starting' || runtime.status === 'stopping';
  const stopped = runtime.status === 'stopped';

  const ask = useCallback(
    async (mutation: 'SpaceStartRuntime' | 'SpaceStopRuntime') => {
      setAsking(true);
      await mutateNetwork(mutation, { environment: runtime.environment });
      await onChange();
      setAsking(false);
    },
    [mutateNetwork, onChange, runtime.environment]
  );
  const handleStart = useCallback(() => ask('SpaceStartRuntime'), [ask]);
  const handleStop = useCallback(() => ask('SpaceStopRuntime'), [ask]);

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-gray-500 dark:text-zinc-400">
        {stopped && runtime.stoppedReason === 'idle' && `Stopped after ${idleDurationOf(idleMinutes)} without use.`}
        {stopped && runtime.stoppedReason === 'manual' && 'Stopped by hand.'}
        {runtime.status === 'ready' &&
          runtime.idleStopsAt !== null &&
          `Stops by itself on ${stopMomentOf(runtime.idleStopsAt)} if nothing uses it.`}
      </span>
      {(stopped || runtime.status === 'stopping') && (
        <Button size="xs" intent="primary" onClick={handleStart} disabled={asking || passing}>
          Start
        </Button>
      )}
      {(runtime.status === 'ready' || runtime.status === 'starting') && (
        <Button size="xs" intent="secondary" onClick={handleStop} disabled={asking || passing}>
          Stop
        </Button>
      )}
    </div>
  );
};

export default RuntimePower;
