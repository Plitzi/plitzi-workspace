import { get } from '@plitzi/plitzi-ui/helpers';
import clsx from 'clsx';
import { useCallback, use, useMemo, useEffect, useState } from 'react';

import InteractionsContext from '@plitzi/sdk-interactions/InteractionsContext';
import utility from '@plitzi/sdk-interactions/utility/index';
import { emptyObject } from '@plitzi/sdk-shared/helpers/utils';
import { useBuilderStore } from '@plitzi/sdk-shared/store';

import Workflow from './components/Workflow';

import type { Element, InteractionCallback, Source } from '@plitzi/sdk-shared';

export type InteractionsProps = {
  className?: string;
  idRef?: string;
  interactions?: Element['definition']['interactions'];
  onChange?: (interactions: Element['definition']['interactions']) => void;
};

const Interactions = ({ className = '', idRef = '', interactions = emptyObject, onChange }: InteractionsProps) => {
  const [sourcesRegistry] = useBuilderStore('sources');
  const [schemaFlat] = useBuilderStore('schema.flat');
  const { interactionsManager } = use(InteractionsContext);
  const [reRender, setRerender] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const subscriptor = useMemo(() => interactionsManager.getSubscriptor(idRef), [idRef, interactionsManager, reRender]);

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
      definitions.push({ action: triggerKey, title, type: 'trigger', params, preview, elementId: idRef });
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

    const flat = schemaFlat as Record<string, Element> | undefined;
    Object.values(flat ?? {}).forEach(element => {
      if (element.idRef) {
        return;
      }

      definitions.push({
        action: '',
        elementId: element.id,
        title: element.definition.label || element.definition.type,
        type: 'callback',
        unreferenced: true,
        params: {},
        preview: {}
      });
    });

    return definitions;
  }, [idRef, subscriptor, interactionsManager, schemaFlat]);

  useEffect(() => {
    return interactionsManager.onUpdate((timestamp: number) => {
      setRerender(timestamp);
    });
  }, [interactionsManager]);

  const dataSource = useMemo<Record<string, Source['meta']>>(
    () =>
      Object.values(sourcesRegistry ?? {})
        .filter(source => source.meta.source)
        .reduce((acum, source) => ({ ...acum, [source.meta.source as string]: source.meta }), {}),
    [sourcesRegistry]
  );

  if (!idRef) {
    return (
      <div className={clsx('flex grow flex-col', className)}>
        <div className="m-3 self-stretch rounded-sm border-2 border-dashed border-gray-300 p-3 text-center text-zinc-600 dark:border-zinc-600 dark:text-zinc-400">
          Give this element a Reference (the link button in Settings) before adding interactions — the runtime wires
          them by that name.
        </div>
      </div>
    );
  }

  return (
    <div className={clsx('flex grow flex-col', className)}>
      <Workflow
        key={idRef}
        nodes={interactions}
        direction="vertical"
        dataSource={dataSource}
        nodeDefinitions={nodeDefinitions}
        onChange={handleWorkflowChange}
      />
    </div>
  );
};

export default Interactions;
