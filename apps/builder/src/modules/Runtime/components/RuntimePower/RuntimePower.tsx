import Button from '@plitzi/plitzi-ui/Button';
import { use, useCallback, useState } from 'react';

import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';

import type { BuilderMutationsMap, BuilderQueriesMap, SpaceRuntimeEnvironment } from '@plitzi/sdk-shared';
import type { BuilderNetworkContextValue } from '@plitzi/sdk-shared/network/NetworkContext';

export type RuntimePowerProps = {
  runtime: SpaceRuntimeEnvironment;
  /** How long a runtime may go unused before it is stopped; 0 when the platform never stops one. */
  idleMinutes: number;
  /** Asked once it was started or stopped, to read the runtime again. */
  onChange: () => Promise<void>;
};

const clockOf = (seconds: number): string =>
  new Date(seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/**
 * Starting and stopping an environment's runtime — and saying when it stops by itself: a runtime nobody uses for a while
 * is stopped so it spends nothing, and stays stopped until somebody starts it again, here or with a push or a publish.
 */
const RuntimePower = ({ runtime, idleMinutes, onChange }: RuntimePowerProps) => {
  const { mutate: mutateNetwork } = use(NetworkContext) as BuilderNetworkContextValue<
    BuilderQueriesMap,
    BuilderMutationsMap
  >;
  // Asked, and not yet reflected: the orchestrator takes it up on its next round.
  const [asked, setAsked] = useState<SpaceRuntimeEnvironment['status'] | undefined>(undefined);
  const busy = asked !== undefined && asked !== runtime.status;
  const stopped = runtime.status === 'stopped';

  const handleStart = useCallback(async () => {
    setAsked('ready');
    await mutateNetwork('SpaceStartRuntime', { environment: runtime.environment });
    await onChange();
  }, [mutateNetwork, onChange, runtime.environment]);

  const handleStop = useCallback(async () => {
    setAsked('stopped');
    await mutateNetwork('SpaceStopRuntime', { environment: runtime.environment });
    await onChange();
  }, [mutateNetwork, onChange, runtime.environment]);

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-gray-500 dark:text-zinc-400">
        {stopped && runtime.stoppedReason === 'idle' && `Stopped after ${String(idleMinutes)} minutes without use.`}
        {stopped && runtime.stoppedReason === 'manual' && 'Stopped by hand.'}
        {runtime.status === 'ready' &&
          runtime.idleStopsAt !== null &&
          `Stops by itself at ${clockOf(runtime.idleStopsAt)} if nothing uses it.`}
      </span>
      {stopped && (
        <Button size="xs" intent="primary" onClick={handleStart} disabled={busy}>
          {busy ? 'Starting…' : 'Start'}
        </Button>
      )}
      {runtime.status === 'ready' && (
        <Button size="xs" intent="secondary" onClick={handleStop} disabled={busy}>
          {busy ? 'Stopping…' : 'Stop'}
        </Button>
      )}
    </div>
  );
};

export default RuntimePower;
