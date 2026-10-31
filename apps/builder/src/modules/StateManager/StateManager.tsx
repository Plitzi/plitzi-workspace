import { useDidUpdateEffect } from '@plitzi/plitzi-ui';
import Button from '@plitzi/plitzi-ui/Button';
import CodeMirror from '@plitzi/plitzi-ui/CodeMirror';
import { useToast } from '@plitzi/plitzi-ui/Toast';
import clsx from 'clsx';
import { useCallback, useState } from 'react';

import { emptyObject } from '@plitzi/sdk-shared/helpers';
import { useBuilderStore } from '@plitzi/sdk-shared/store';
import { useTheme } from '@plitzi/sdk-shared/theme';

export type StateManagerProps = {
  className?: string;
};

const StateManager = ({ className = '' }: StateManagerProps) => {
  const { resolvedTheme } = useTheme();
  const [state = emptyObject, setState] = useBuilderStore('runtime.state');
  const [value, setValue] = useState(() => JSON.stringify(state, null, 2));
  const { addToast } = useToast();

  const handleChange = useCallback((value: string) => setValue(value), []);

  const handleClickSave = useCallback(() => {
    try {
      setState(JSON.parse(value) as Record<string, unknown>);
      setValue(JSON.stringify(JSON.parse(value), null, 2));
    } catch {
      addToast('The state is not valid JSON — fix it and apply it again', {
        appeareance: 'error',
        autoDismiss: true,
        placement: 'top-right'
      });
    }
  }, [setState, value, addToast]);

  useDidUpdateEffect(() => {
    setValue(JSON.stringify(state, null, 2));
  }, [state]);

  return (
    <div className={clsx('flex h-full w-full flex-col gap-2 p-2', className)}>
      <div className="flex flex-col items-end gap-2">
        <p className="self-stretch text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
          The page's state as the canvas runs it now. Change it and apply it to see the page in that case — nothing of
          the space is saved.
        </p>
        <Button size="xs" iconPlacement="before" onClick={handleClickSave}>
          <Button.Icon icon="fa-solid fa-check" />
          Apply
        </Button>
      </div>
      <CodeMirror
        className="min-h-0 grow overflow-hidden rounded-md border border-gray-300 dark:border-zinc-700"
        value={value}
        theme={resolvedTheme}
        lineWrapping
        onChange={handleChange}
        mode="json"
      />
    </div>
  );
};

export default StateManager;
