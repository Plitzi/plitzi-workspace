import Alert from '@plitzi/plitzi-ui/Alert';
import Select from '@plitzi/plitzi-ui/Select';
import { use, useCallback, useState } from 'react';

import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';

import type { BuilderMutationsMap, BuilderQueriesMap, SpaceRuntimeSizeOption } from '@plitzi/sdk-shared';
import type { BuilderNetworkContextValue } from '@plitzi/sdk-shared/network/NetworkContext';

export type RuntimeSizeProps = {
  environment: string;
  /** The size it runs at, by name. */
  size: string;
  sizes: SpaceRuntimeSizeOption[];
  /** Asked once the size changed, to read the runtime again. */
  onChange: () => Promise<void>;
};

/** Cores, from how Kubernetes writes them: `250m` is a quarter of one. */
const coresOf = (cpu: string): string => (cpu.endsWith('m') ? String(Number(cpu.slice(0, -1)) / 1000) : cpu);

/** Memory, from how Kubernetes writes it, as a person reads it: `256Mi` is 256 MB, `1Gi` 1 GB. */
const memoryOf = (memory: string): string => memory.replace(/Mi$/, ' MB').replace(/Gi$/, ' GB');

/** What a size may spend, in one line. */
const spendOf = (option: SpaceRuntimeSizeOption): string => `${coresOf(option.cpu)} CPU · ${memoryOf(option.memory)}`;

const messageOf = (error: string | Error | undefined): string =>
  (error instanceof Error ? error.message : error) || 'The size could not be changed.';

/**
 * The size an environment's runtime runs at — what its pod may spend — and choosing another, among those the space's
 * plan includes. A size the plan does not include is shown, and not offered.
 */
const RuntimeSize = ({ environment, size, sizes, onChange }: RuntimeSizeProps) => {
  const { mutate: mutateNetwork } = use(NetworkContext) as BuilderNetworkContextValue<
    BuilderQueriesMap,
    BuilderMutationsMap
  >;
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const current = sizes.find(option => option.name === size);

  const handleChange = useCallback(
    async (value: string) => {
      setProblem(undefined);
      const response = await mutateNetwork('SpaceSetRuntimeSize', { environment, size: value });
      if (!response.success) {
        setProblem(messageOf(response.error));

        return;
      }

      await onChange();
    },
    [environment, mutateNetwork, onChange]
  );

  return (
    <div className="flex flex-col gap-1">
      <Select value={size} label="Size" onChange={handleChange} size="xs">
        {sizes.map(option => (
          <option key={option.name} value={option.name} disabled={!option.included}>
            {`${option.label} — ${spendOf(option)}`}
            {!option.included && ' (not in this plan)'}
          </option>
        ))}
      </Select>
      {current && (
        <span className="text-xs text-gray-500 dark:text-zinc-400">
          Its pod may spend {spendOf(current)}. A laptop runs it as a process of its own, unbounded.
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
