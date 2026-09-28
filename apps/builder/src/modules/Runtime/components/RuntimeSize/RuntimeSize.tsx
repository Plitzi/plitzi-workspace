import Alert from '@plitzi/plitzi-ui/Alert';
import Button from '@plitzi/plitzi-ui/Button';
import Select from '@plitzi/plitzi-ui/Select';
import { use, useCallback, useState } from 'react';

import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';

import type {
  BuilderMutationsMap,
  BuilderQueriesMap,
  SpaceRuntimeEnvironment,
  SpaceRuntimeSizeOption
} from '@plitzi/sdk-shared';
import type { BuilderNetworkContextValue } from '@plitzi/sdk-shared/network/NetworkContext';

export type RuntimeSizeProps = {
  environment: string;
  /** The size it runs at, by name. */
  size: string;
  status: SpaceRuntimeEnvironment['status'];
  sizes: SpaceRuntimeSizeOption[];
  /** Asked once the size changed, to read the runtime again. */
  onChange: () => Promise<void>;
};

/** Cores, from how Kubernetes writes them: `250m` is a quarter of one. */
const coresOf = (cpu: string): string => (cpu.endsWith('m') ? String(Number(cpu.slice(0, -1)) / 1000) : cpu);

/** Memory, from how Kubernetes writes it, as a person reads it: `256Mi` is 256 MB, `1Gi` 1 GB. */
const memoryOf = (memory: string): string => memory.replace(/Mi$/, ' MB').replace(/Gi$/, ' GB');

const optionLabelOf = (option: SpaceRuntimeSizeOption): string =>
  `${option.label} — ${coresOf(option.cpu)} CPU, ${memoryOf(option.memory)}${option.included ? '' : ' (not in this plan)'}`;

const messageOf = (error: string | Error | undefined): string =>
  (error instanceof Error ? error.message : error) || 'The size could not be changed.';

/**
 * The size an environment's runtime runs at, and choosing another among those the space's plan includes. Nothing
 * changes until it is applied — a restart is not something a slip of the select should cause — and while the runtime
 * restarts at the new size, it says so.
 */
const RuntimeSize = ({ environment, size, status, sizes, onChange }: RuntimeSizeProps) => {
  const { mutate: mutateNetwork } = use(NetworkContext) as BuilderNetworkContextValue<
    BuilderQueriesMap,
    BuilderMutationsMap
  >;
  const [choice, setChoice] = useState(size);
  const [applying, setApplying] = useState<string | undefined>(undefined);
  const [problem, setProblem] = useState<string | undefined>(undefined);
  // Applied, and not yet what it runs at: the restart it asked for is under way.
  const restarting = applying !== undefined && (applying !== size || status !== 'ready');
  const restartingAt = sizes.find(option => option.name === applying);

  const handleApply = useCallback(async () => {
    setProblem(undefined);
    setApplying(choice);
    const response = await mutateNetwork('SpaceSetRuntimeSize', { environment, size: choice });
    if (!response.success) {
      setApplying(undefined);
      setProblem(messageOf(response.error));

      return;
    }

    await onChange();
  }, [choice, environment, mutateNetwork, onChange]);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-end gap-2">
        <div className="grow">
          <Select value={choice} label="Size" onChange={setChoice} size="xs" disabled={restarting}>
            {sizes.map(option => (
              <option key={option.name} value={option.name} disabled={!option.included}>
                {optionLabelOf(option)}
              </option>
            ))}
          </Select>
        </div>
        <Button size="xs" onClick={handleApply} disabled={restarting || choice === size}>
          Apply
        </Button>
      </div>
      {restarting && restartingAt && (
        <span className="text-xs text-blue-600 dark:text-blue-400">Restarting at {restartingAt.label}…</span>
      )}
      {!restarting && (
        <span className="text-xs text-gray-500 dark:text-zinc-400">
          The processing power and memory this runtime may use. Applying a new size restarts it.
        </span>
      )}
      {problem && (
        <Alert intent="error" size="xs" solid={false}>
          {problem}
        </Alert>
      )}
    </div>
  );
};

export default RuntimeSize;
