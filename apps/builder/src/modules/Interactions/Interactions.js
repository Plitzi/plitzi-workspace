// Packages
import React, { useCallback, useContext, useMemo } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';
import get from 'lodash/get';

// Monorepo
import InteractionsContext from '@repo/interactions-shared/InteractionsContext';
import utility from '@repo/interactions-shared/utility';

// Alias
import Workflow from './components/Workflow';

// Relatives
import { emptyObject } from '../../helpers/utils';

const Interactions = props => {
  const { className = '', id = '', interactions = emptyObject, onChange = noop } = props;
  const { interactionsManager } = useContext(InteractionsContext);
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

Interactions.propTypes = {
  className: PropTypes.string,
  id: PropTypes.string,
  interactions: PropTypes.object,
  onChange: PropTypes.func
};

export default Interactions;
