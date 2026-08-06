import { reconcileParams, unknownParams } from './paramSpec';

import type { ParamSpec } from './paramSpec';

// Built-in `callback`-type actions that EVERY element registers on itself (mirror of sdk-elements
// Element/helpers/getInteractions — the default set shared by all element types). A specific element TYPE can add
// MORE callbacks of its own (plugin-provided), which the SSR runtime cannot enumerate here — so an unlisted
// `callback` action is treated leniently (a warning against observed names, never a hard error), and only the
// actions in this catalog are validated against a schema. Unlike a globalCallback — which is provided by a source
// module and whose `elementId` is that module — an element callback runs against a real element, so its node
// `elementId` is the element's own idRef (the flow host, or another element the step targets). The runtime resolves
// it as `callbacksAvailables[elementId][action]`.
//
// `setState` is the confusing one: there is ALSO a global `setState` (source `state`) with a DIFFERENT param schema
// (key/type/value, writes runtime.state.*). The two are told apart by node type — a `callback` setState is THIS
// element schema; a `globalCallback` setState is the state-source schema. This element `setState` changes the
// element's own attribute or state, and its `revertOnFinish` flag makes the change undo itself when the whole flow
// finishes (a postCallback that runs in reverse) — the correct way to do a temporary change (a "loading…" label, a
// disabled button) WITHOUT adding manual restore steps.

export interface BuiltinElementCallback {
  title: string;
  // When true the param set is CLOSED: any key not listed is a mistake (dropped on apply, warned in validation).
  strictParams: boolean;
  params: ParamSpec;
}

export const BUILTIN_ELEMENT_CALLBACKS: Record<string, BuiltinElementCallback> = {
  setState: {
    title: 'Update Element (set attribute / state)',
    strictParams: true,
    params: {
      category: {
        type: 'select',
        description:
          'What to change on the element: "attribute" sets one of its props (the common case — e.g. content, ' +
          'disabled); "state" sets element state (visibility or a style selector). REQUIRED — always set it.',
        default: 'attribute',
        options: ['attribute', 'state'],
        required: true
      },
      key: {
        type: 'text',
        description:
          'The field to set. When category="attribute", an attribute/prop key of THIS element (e.g. "content", ' +
          '"disabled"). When category="state", "visibility" or "styleSelectors.<selector>". REQUIRED.',
        required: true
      },
      value: {
        // Polymorphic: the value follows the target attribute's own type — a boolean attribute stores a real boolean
        // (true/false), a number a real number, everything else a string. The runtime also coerces the strings
        // "true"/"false"/"yes"/"no" to a boolean, but the stored value is whatever type the attribute holds. There is
        // NO separate `type` param here (that belongs to the global state setState, not this one).
        type: 'scalar',
        description:
          'The value to set — its type follows the target attribute: a real boolean (true/false) for a boolean ' +
          'attribute, a number for a numeric one, otherwise a string (the strings "true"/"false" also coerce). There ' +
          'is NO separate `type` param (that belongs to the global state setState, not this one). REQUIRED.',
        when: params => Boolean(params.category),
        required: true
      },
      revertOnFinish: {
        type: 'boolean',
        description:
          'When true, this change is UNDONE automatically when the whole flow finishes. Use it for a TEMPORARY ' +
          'change (a "loading…" label, disabling a button while it works) instead of adding manual restore steps at ' +
          'the end of the flow.',
        default: false
      }
    }
  }
};

/** The built-in element callback for an action, or undefined when the action is not a known built-in (an
 *  element-type-specific/plugin callback whose schema is not knowable here). */
export const getElementCallback = (action: string): BuiltinElementCallback | undefined =>
  Object.hasOwn(BUILTIN_ELEMENT_CALLBACKS, action) ? BUILTIN_ELEMENT_CALLBACKS[action] : undefined;

/** Param keys the agent supplied that are not valid for a built-in element callback (only for CLOSED sets). []
 *  for an unknown action (a plugin/element-specific callback whose schema is not known here). */
export const unknownElementCallbackParams = (action: string, params: Record<string, unknown>): string[] => {
  const builtin = getElementCallback(action);
  if (!builtin || !builtin.strictParams) {
    return [];
  }

  return unknownParams(params, builtin.params);
};

/** Reconcile a `callback` action against the element-callback catalog: unknown keys dropped for a closed callback,
 *  then missing defaults filled (category:"attribute", revertOnFinish:false). An unknown action yields unchanged
 *  params, so a plugin/element-specific callback keeps whatever the agent passed. */
export const applyElementCallback = (
  action: string,
  params: Record<string, unknown>
): { known: boolean; params: Record<string, unknown> } => {
  const builtin = getElementCallback(action);
  if (!builtin) {
    return { known: false, params };
  }

  return { known: true, params: reconcileParams(params, builtin.params, builtin.strictParams) };
};
