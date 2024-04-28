// Packages
import React, { useCallback, use, useMemo } from 'react';
import classNames from 'classnames';
import noop from 'lodash/noop';
import get from 'lodash/get';

// Monorepo
import InteractionsContext from '@plitzi/sdk-interactions/InteractionsContext';
import utility from '@plitzi/sdk-interactions/utility';
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Alias
import Workflow from './components/Workflow';

/**
 * @param {{
 *   className?: string;
 *   id?: string;
 *   interactions?: object;
 *   onChange?: (interactions: object) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const Interactions = props => {
  const { className = '', id = '', interactions = emptyObject, onChange = noop } = props;
  const { interactionsManager } = use(InteractionsContext);
  const { triggers } = useMemo(() => interactionsManager.getSubscriptor(id) ?? {}, [id, interactionsManager]);

  const handleWorkflowChange = useCallback(workflow => onChange(workflow), [onChange]);

  const nodeDefinitions = useMemo(() => {
    const definitions = [...Object.values(utility)];
    if (!triggers) {
      return definitions;
    }

    Object.keys(triggers).forEach(triggerKey => {
      const { title = `Trigger ${triggerKey}`, params = {}, preview = {} } = triggers[triggerKey];
      definitions.push({ action: triggerKey, title, type: 'trigger', params, preview, elementId: id });
    });

    const callbacksAvailables = interactionsManager.getCallbacksAvailables();
    Object.keys(callbacksAvailables).forEach(elementId => {
      const callbacks = get(callbacksAvailables, elementId, {});
      Object.values(callbacks).forEach(callback => {
        const {
          elementId,
          action,
          title = `Callback ${action} - ${elementId}`,
          params = {},
          preview = {},
          type = 'callback'
        } = callback;
        definitions.push({ action, elementId, title, type, params, preview });
      });
    });

    return definitions;
  }, [id, triggers, interactionsManager]);

  return (
    <div className={classNames('flex flex-col grow', className)}>
      <Workflow
        key={id}
        nodes={interactions}
        onChange={handleWorkflowChange}
        direction="vertical"
        nodeDefinitions={nodeDefinitions}
      />
    </div>
  );
};

export default Interactions;
