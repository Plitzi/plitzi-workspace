import Button from '@plitzi/plitzi-ui/Button';
import Select from '@plitzi/plitzi-ui/Select';
import { useCallback, useState } from 'react';

import { quantityWords } from '@plitzi/sdk-shared/helpers';
import Notice from '@pmodules/App/components/Notice';
import useBuilderNetwork from '@pmodules/Network/hooks/useBuilderNetwork';

import type { SpaceRuntimeEnvironment, SpaceRuntimeSizeOption } from '@plitzi/sdk-shared';

export type RuntimeSizeProps = {
  environment: string;
  /** The size it runs at, by name. */
  size: string;
  status: SpaceRuntimeEnvironment['status'];
  sizes: SpaceRuntimeSizeOption[];
  /** Asked once the size changed, to read the runtime again. */
  onChange: () => Promise<void>;
};

/** Whether the space may run an environment at it: it bought one, or is not bounded. */
const available = (option: SpaceRuntimeSizeOption): boolean => option.bought === null || option.bought > 0;

/**
 * A size as the clouds say it — `Small — 0.25 vCPU · 256 MiB` — from the quantities its pod is given, and what one costs
 * when the space bought none.
 */
const optionLabelOf = (option: SpaceRuntimeSizeOption): string =>
  `${option.label} — ${quantityWords(option.cpu, option.memory) ?? `${option.cpu} CPU, ${option.memory}`}${available(option) ? '' : ` (none bought — ${String(option.displayAmount / 100)} € a month)`}`;

const messageOf = (error: string | Error | undefined): string =>
  (error instanceof Error ? error.message : error) || 'The size could not be changed.';

/**
 * The size an environment's runtime runs at, and choosing another among those the space bought. Nothing
 * changes until it is applied — a restart is not something a slip of the select should cause — and while the runtime
 * restarts at the new size, it says so.
 */
const RuntimeSize = ({ environment, size, status, sizes, onChange }: RuntimeSizeProps) => {
  const { mutate: mutateNetwork } = useBuilderNetwork();
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
              <option key={option.name} value={option.name} disabled={!available(option)}>
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
          The processing power and memory this runtime may use — each size bought on the space&apos;s billing runs one
          environment. Applying a new size restarts it.
        </span>
      )}
      {problem && <Notice tone="danger">{problem}</Notice>}
    </div>
  );
};

export default RuntimeSize;
