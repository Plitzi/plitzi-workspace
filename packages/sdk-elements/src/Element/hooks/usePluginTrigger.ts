import { use, useCallback } from 'react';

import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import useElement from './useElement';

/** What a flow started by an event reads, as the plugin hands it: one value for each field its `preview` names. */
export type PluginTriggerPayload<Preview> = Preview extends object
  ? { [Field in keyof Preview]: unknown }
  : Record<string, never>;

/** What `usePluginTrigger` reads of a declaration: the events it fires, each by its action, with what its flows read. */
export type PluginTriggerDeclaration = { triggers: Record<string, { action: string; preview?: unknown }> };

/**
 * Fires one of the element's declared events — typed by its declaration, so an event it does not declare, or a payload
 * missing a field its flows read, is a compile error: `fire('onEdit', { ops })`. A flow on that event runs with what
 * it was handed.
 *
 * On a live page only: on the builder's canvas the page is being edited, flows never run, and a plugin that fired from
 * an effect would be talking to nobody.
 */
const usePluginTrigger = <const D extends PluginTriggerDeclaration>(declaration: D) => {
  const { id } = useElement();
  const {
    settings: { previewMode = true },
    contexts: { InteractionsContext }
  } = usePlitziServiceContext();
  const { interactionsManager } = use(InteractionsContext);

  return useCallback(
    <Event extends keyof D['triggers'] & string>(
      event: Event,
      payload: PluginTriggerPayload<D['triggers'][Event]['preview']>
    ) => {
      if (!previewMode) {
        return;
      }

      void interactionsManager.interactionTrigger(id, declaration.triggers[event].action, payload);
    },
    [declaration, id, interactionsManager, previewMode]
  );
};

export default usePluginTrigger;
