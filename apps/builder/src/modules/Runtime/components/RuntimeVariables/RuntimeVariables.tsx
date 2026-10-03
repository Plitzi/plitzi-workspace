import Alert from '@plitzi/plitzi-ui/Alert';
import Button from '@plitzi/plitzi-ui/Button';
import Input from '@plitzi/plitzi-ui/Input';
import { useCallback, useState } from 'react';

import ViewSection from '@pmodules/App/components/ViewSection';
import useBuilderNetwork from '@pmodules/Network/hooks/useBuilderNetwork';

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
  const { mutate: mutateNetwork } = useBuilderNetwork();
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
    <ViewSection title="Variables">
      <p className="text-sm text-gray-600 dark:text-zinc-400">
        What the runtime starts with, read as environment variables. A value is written and never read back.
      </p>
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
      {names.length > 0 && (
        <div className="flex flex-col divide-y divide-gray-200 rounded-lg border border-gray-200 dark:divide-zinc-800 dark:border-zinc-800">
          {names.map(variable => (
            <div key={variable} className="flex items-center justify-between gap-2 px-4 py-2.5">
              <span className="font-mono text-sm text-zinc-800 dark:text-zinc-200">{variable}</span>
              <Button
                size="xs"
                intent="secondary"
                border="none"
                className="text-gray-400 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400"
                title={`Remove ${variable}`}
                onClick={handleRemove(variable)}
              >
                <Button.Icon icon="fa-regular fa-trash-can" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </ViewSection>
  );
};

export default RuntimeVariables;
