import { interactionBasicTriggers } from '../Element/helpers/elementConstants';

import type { StepSpec } from '@plitzi/sdk-schema';

/**
 * How a flow starts, and how an element changes itself.
 *
 * These are the two halves of a flow that belong to elements rather than to a source module: a trigger fires on
 * the element it is declared on, and an element callback runs against an element by idRef. Neither takes a source
 * module, and giving one is how a flow ends up wired to nothing.
 *
 * A trigger's `on` is left out on purpose: `authorSpace` fills it with the element the flow was declared on, which
 * is what it is in every case. Naming one is for the rare flow declared in one place and fired from another.
 */

export type ElementTriggerName = keyof typeof interactionBasicTriggers;

/**
 * `on('onClick')`, and the same for every other trigger.
 *
 * The basic set every element registers is named and autocompletes; any other string is accepted because a TYPE
 * may publish triggers of its own — a form's `onSubmit`, a provider's page change — and refusing those would make
 * the builders useless for exactly the flows that matter most.
 */
export const on = (trigger: ElementTriggerName | (string & {}), params: Record<string, unknown> = {}): StepSpec => {
  // Asked rather than indexed: the argument may name no built-in trigger at all — an element type is free to
  // publish its own — and the record's type says every key is there.
  const declared = Object.hasOwn(interactionBasicTriggers, trigger) ? interactionBasicTriggers[trigger] : undefined;

  return {
    type: 'trigger',
    action: trigger,
    title: declared?.title ?? trigger,
    ...(declared?.preview ? { preview: declared.preview as Record<string, unknown> } : {}),
    params
  };
};

/**
 * A form submitting itself, with the values keyed by each control's `name`.
 *
 * The form's own trigger rather than one of the basic set — and the reason it is worth a builder is what a flow
 * does next: `{{ <this step's id>.values.<name> }}` is how a login step gets the credentials, so this is nearly
 * always a step somebody has to be able to name.
 */
export const onSubmit = (): StepSpec => on('onSubmit');

export const onClick = (params: { propagateEvent?: boolean } = {}): StepSpec => on('onClick', params);

export const onLoad = (): StepSpec => on('onLoad');

/**
 * The end of a server action this element started — the trigger a `detached` run needs, because that step returns
 * the moment the server accepts the work and leaves the page with nothing to react to when it finishes.
 */
export const onFlowEnd = (): StepSpec => on('onFlowEnd');

export const onFlowError = (): StepSpec => on('onFlowError');

export const onFlowProgress = (): StepSpec => on('onFlowProgress');

/**
 * Changes one element's own attribute or state — the element `setState`, which is NOT the global one that writes
 * `runtime.state`. Left without a target it runs against the element the flow is declared on.
 *
 * `revertOnFinish` undoes the change when the whole flow ends, which is the correct way to do a temporary one — a
 * "loading…" label, a disabled button — without a second step to put it back.
 */
export const updateElement = (
  params:
    | { category: 'attribute'; key: string; value: unknown; revertOnFinish?: boolean }
    | { category: 'state'; key: string; value: unknown; revertOnFinish?: boolean },
  target?: string
): StepSpec => ({
  type: 'callback',
  action: 'setState',
  title: 'Update Element',
  ...(target === undefined ? {} : { on: target }),
  params
});
