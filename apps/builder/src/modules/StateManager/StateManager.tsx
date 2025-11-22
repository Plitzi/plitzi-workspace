import Button from '@plitzi/plitzi-ui/Button';
import CodeMirror from '@plitzi/plitzi-ui/CodeMirror';
import { useToast } from '@plitzi/plitzi-ui/Toast';
import classNames from 'classnames';
import isEqual from 'lodash-es/isEqual';
import { useCallback, use, useEffect, useState } from 'react';

import StateManagerContext from '@plitzi/sdk-state/StateManagerContext';

export type StateManagerProps = {
  className?: string;
};

const StateManager = ({ className = '' }: StateManagerProps) => {
  const { state, setState } = use(StateManagerContext);
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

  useEffect(() => {
    if (!isEqual(value, state)) {
      setValue(JSON.stringify(state, null, 2));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <div className={classNames('relative flex h-full w-full flex-col', className)}>
      <CodeMirror className="h-full" value={value} theme="dark" lineWrapping onChange={handleChange} mode="json" />
      <div className="absolute top-3 right-3 flex">
        <Button
          intent="custom"
          size="custom"
          className="mr-2 rounded-sm bg-white p-2"
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
