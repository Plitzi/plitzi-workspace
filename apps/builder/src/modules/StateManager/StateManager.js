// Packages
import React, { useCallback, use, useEffect, useState } from 'react';
import classNames from 'classnames';
import isEqual from 'lodash/isEqual';
import Button from '@plitzi/plitzi-ui-components/Button';
import useToast from '@plitzi/plitzi-ui-components/Toast/useToast';
import CodeMirror from '@plitzi/plitzi-ui/CodeMirror';

// Monorepo
import StateManagerContext from '@plitzi/sdk-state/StateManagerContext';

/**
 * @param {{
 *   className?: string;
 * }} props
 * @returns {React.ReactElement}
 */
const StateManager = props => {
  const { className = '' } = props;
  const { state, setState } = use(StateManagerContext);
  const [value, setValue] = useState(() => JSON.stringify(state, null, 2));
  const { addToast } = useToast();

  const handleChange = useCallback(v => setValue(v), []);

  const handleClickSave = useCallback(() => {
    try {
      setState(JSON.parse(value));
      setValue(JSON.stringify(JSON.parse(value), null, 2));
    } catch (e) {
      addToast('Json Malformed, Please fix it and try again', {
        appeareance: 'danger',
        autoDismiss: true,
        placement: 'top-right'
      });
    }
  }, [setState, value, addToast]);

  useEffect(() => {
    if (!isEqual(value, state)) {
      setValue(JSON.stringify(state, null, 2));
    }
  }, [state]);

  return (
    <div className={classNames('h-full flex flex-col relative w-full', className)}>
      <CodeMirror value={value} theme="dark" lineWrapping onChange={handleChange} mode="json" />
      <div className="flex absolute top-3 right-3">
        <Button
          intent="custom"
          size="custom"
          className="p-2 bg-white rounded mr-2"
          onClick={handleClickSave}
          tilte="Save State"
        >
          <i className="fa-solid fa-floppy-disk" />
        </Button>
      </div>
    </div>
  );
};

export default StateManager;
