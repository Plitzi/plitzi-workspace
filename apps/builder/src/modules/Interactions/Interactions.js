// Packages
import React, { useCallback, useContext, useMemo } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';
import get from 'lodash/get';

// Alias
import Workflow from './components/Workflow';

// Relatives
import InteractionsContext from './InteractionsContext';
import utility from './utility';
import { emptyObject } from '../../helpers/utils';

const Interactions = props => {
  const { className = '', id = '', interactions = emptyObject, onChange = noop } = props;
  const { getSubscriptor, getCallbacksAvailables } = useContext(InteractionsContext);
  const { triggers } = useMemo(() => getSubscriptor(id) ?? {}, [id]);

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

    const callbacksAvailables = getCallbacksAvailables();
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
  }, [id, triggers, getCallbacksAvailables]);

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
