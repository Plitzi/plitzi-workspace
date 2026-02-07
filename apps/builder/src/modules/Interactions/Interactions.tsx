import clsx from 'clsx';
import get from 'lodash-es/get';
import { useCallback, use, useMemo, useEffect, useState } from 'react';

import InteractionsContext from '@plitzi/sdk-interactions/InteractionsContext';
import utility from '@plitzi/sdk-interactions/utility/index';
import { emptyObject } from '@plitzi/sdk-shared/helpers/utils';

import Workflow from './components/Workflow';

import type { Element, InteractionCallback } from '@plitzi/sdk-shared';

export type InteractionsProps = {
  className?: string;
  id?: string;
  interactions?: Element['definition']['interactions'];
  onChange?: (interactions: Element['definition']['interactions']) => void;
};

const Interactions = ({ className = '', id = '', interactions = emptyObject, onChange }: InteractionsProps) => {
  const { interactionsManager } = use(InteractionsContext);
  const [reRender, setRerender] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const subscriptor = useMemo(() => interactionsManager.getSubscriptor(id), [id, interactionsManager, reRender]);

  const handleWorkflowChange = useCallback(
    (workflow: Element['definition']['interactions']) => onChange?.(workflow),
    [onChange]
  );

  const nodeDefinitions = useMemo(() => {
    const definitions = [...Object.values(utility)] as InteractionCallback[];
    if (!subscriptor) {
      return definitions;
    }

    const { triggers } = subscriptor;
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
  }, [id, subscriptor, interactionsManager]);

  useEffect(() => {
    return interactionsManager.onUpdate((timestamp: number) => {
      setRerender(timestamp);
    });
  }, [interactionsManager]);

  return (
    <div className={clsx('flex grow flex-col', className)}>
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
