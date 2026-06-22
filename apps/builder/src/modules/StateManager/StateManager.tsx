import { useDidUpdateEffect } from '@plitzi/plitzi-ui';
import Button from '@plitzi/plitzi-ui/Button';
import CodeMirror from '@plitzi/plitzi-ui/CodeMirror';
import { useToast } from '@plitzi/plitzi-ui/Toast';
import clsx from 'clsx';
import { useCallback, use, useState } from 'react';

import { createStoreHook } from '@plitzi/nexus/react';
import { emptyObject } from '@plitzi/sdk-shared/helpers/utils';
import { ThemeContext } from '@plitzi/sdk-shared/theme/ThemeProvider';

import type { BuilderState } from '@plitzi/sdk-shared';

export type StateManagerProps = {
  className?: string;
};

const StateManager = ({ className = '' }: StateManagerProps) => {
  const { theme } = use(ThemeContext);
  const { useStore } = createStoreHook<BuilderState>();
  const [state = emptyObject, setState] = useStore('runtime.state');
  const [value, setValue] = useState(() => JSON.stringify(state, null, 2));
  const { addToast } = useToast();

  const handleChange = useCallback((value: string) => setValue(value), []);

  const handleClickSave = useCallback(() => {
    try {
      setState(JSON.parse(value) as Record<string, unknown>);
      setValue(JSON.stringify(JSON.parse(value), null, 2));
    } catch {
      addToast('Json Malformed, Please fix it and try again', {
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
    <div className={clsx('relative flex h-full w-full flex-col', className)}>
      <CodeMirror
        className="h-full"
        value={value}
        theme={theme === 'dark' ? 'dark' : 'light'}
        lineWrapping
        onChange={handleChange}
        mode="json"
      />
      <div className="absolute top-3 right-3 flex">
        <Button
          intent="custom"
          size="custom"
          className="mr-2 rounded-sm bg-white p-2 text-zinc-800 shadow dark:bg-zinc-700 dark:text-zinc-200"
          onClick={handleClickSave}
          title="Save State"
        >
          <i className="fa-solid fa-floppy-disk" />
        </Button>
      </div>
    </div>
  );
};

export default StateManager;
