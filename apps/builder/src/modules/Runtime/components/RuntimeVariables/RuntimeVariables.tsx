import Alert from '@plitzi/plitzi-ui/Alert';
import Button from '@plitzi/plitzi-ui/Button';
import Heading from '@plitzi/plitzi-ui/Heading';
import Input from '@plitzi/plitzi-ui/Input';
import { use, useCallback, useState } from 'react';

import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';

import type { BuilderMutationsMap, BuilderQueriesMap } from '@plitzi/sdk-shared';
import type { BuilderNetworkContextValue } from '@plitzi/sdk-shared/network/NetworkContext';

export type RuntimeVariablesProps = {
  /** The variables it has, by name. */
  names: string[];
  onChange: () => Promise<void>;
};

const messageOf = (error: string | Error | undefined): string =>
  (error instanceof Error ? error.message : error) || 'The variable could not be set.';

/**
 * What the runtime starts with — a connection string, a key. Written here and never read back: a value is kept
 * encrypted and handed to the runtime alone. Changing one starts the runtime again with it.
 */
const RuntimeVariables = ({ names, onChange }: RuntimeVariablesProps) => {
  const { mutate: mutateNetwork } = use(NetworkContext) as BuilderNetworkContextValue<
    BuilderQueriesMap,
    BuilderMutationsMap
  >;
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [problem, setProblem] = useState('');

  const handleSet = useCallback(async () => {
    const response = await mutateNetwork('SpaceSetRuntimeVariable', { name: name.trim(), value });
    if (!response.success) {
      setProblem(messageOf(response.error));

      return;
    }

    setProblem('');
    setName('');
    setValue('');
    await onChange();
  }, [mutateNetwork, name, onChange, value]);

  const handleRemove = useCallback(
    (variable: string) => async () => {
      const response = await mutateNetwork('SpaceRemoveRuntimeVariable', { name: variable });
      if (response.success) {
        await onChange();
      }
    },
    [mutateNetwork, onChange]
  );

  return (
    <div className="flex flex-col gap-3">
      <Heading as="h6">Variables</Heading>
      <div className="flex items-end gap-2">
        <Input
          size="sm"
          name="runtimeVariableName"
          value={name}
          onChange={setName}
          label="Name"
          placeholder="REDIS_URL"
        />
        <Input
          size="sm"
          className="grow"
          name="runtimeVariableValue"
          type="password"
          value={value}
          onChange={setValue}
          label="Value"
        />
        <Button size="sm" onClick={handleSet}>
          Set
        </Button>
      </div>
      {problem && (
        <Alert intent="error" size="xs" solid={false}>
          {problem}
        </Alert>
      )}
      {names.length === 0 && (
        <span className="text-xs text-gray-500 dark:text-zinc-400">It starts with no variables.</span>
      )}
      {names.map(variable => (
        <div
          key={variable}
          className="flex items-center justify-between gap-2 rounded-sm border border-gray-200 px-3 py-2 dark:border-zinc-700"
        >
          <span className="font-mono text-sm">{variable}</span>
          <Button size="sm" intent="danger" onClick={handleRemove(variable)}>
            Remove
          </Button>
        </div>
      ))}
    </div>
  );
};

export default RuntimeVariables;
