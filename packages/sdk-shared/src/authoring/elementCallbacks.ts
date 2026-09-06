import { reconcileParams } from './paramSpec';

import type { BuiltinActionSpec } from './builder';

// Built-in `callback`-type actions that EVERY element registers on itself, beside the code that registers them
// (`@plitzi/sdk-elements`'s `Element/helpers/getInteractions` — the default set shared by all element types). A specific element TYPE can add
// MORE callbacks of its own (plugin-provided), which the SSR runtime cannot enumerate here — so an unlisted
// `callback` action is treated leniently (a warning against observed names, never a hard error), and only the
// actions in this catalog are validated against a schema. Unlike a globalCallback — which is provided by a source
// module and whose `elementId` is that module — an element callback runs against a real element, so its node
// `elementId` is the element's own id (the flow host, or another element the step targets). The runtime resolves
// it as `callbacksAvailables[elementId][action]`.
//
// `setState` and `toggleState` are the confusing ones: there are ALSO global `setState`/`toggleState` (source
// `state`) with DIFFERENT param schemas (writing runtime.state.*). Each pair is told apart by node type — a
// `callback` one is THIS element schema; a `globalCallback` one is the state-source schema. These change the
// element's own attribute or state, and their `revertOnFinish` flag makes the change undo itself when the whole flow
// finishes (a postCallback that runs in reverse) — the correct way to do a temporary change (a "loading…" label, a
// disabled button) WITHOUT adding manual restore steps.

export type BuiltinElementCallback = BuiltinActionSpec;

export const BUILTIN_ELEMENT_CALLBACKS: Record<string, BuiltinElementCallback> = {
  setState: {
    title: 'Update Element (set attribute / state)',
    // Runs against an ELEMENT, so its node carries an element id rather than a source module — the one thing that
    // tells this `setState` from the global one at the runtime's lookup.
    type: 'callback',
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
        default: false,
        label: 'Revert changes after interaction'
      }
    }
  },
  /**
   * Expand and collapse from ONE flow on ONE trigger — the same write as `setState`, except the value it stores is
   * the opposite of the one already there.
   *
   * Written with `setState` this needed two steps whose `when` conditions had to be exact complements of each other,
   * and those conditions read the state as it was when the flow STARTED: the pattern only worked because the second
   * branch happened to see a value one step behind, and stopped working the moment anything else in the flow touched
   * the same key. There is no ordering to get wrong here.
   */
  toggleState: {
    title: 'Toggle Element (flip attribute / state)',
    type: 'callback',
    strictParams: true,
    params: {
      category: {
        type: 'select',
        description:
          'What to flip on the element: "attribute" flips one of its props (e.g. disabled); "state" flips element ' +
          'state ("visibility", or "styleSelectors.<selector>" for an expanded/collapsed look). REQUIRED.',
        default: 'state',
        options: ['attribute', 'state'],
        required: true
      },
      key: {
        type: 'text',
        description:
          'The field to flip. When category="attribute", an attribute/prop key of THIS element. When ' +
          'category="state", "visibility" or "styleSelectors.<selector>". Anything not already true counts as ' +
          'false, so a field that has never been set flips ON first. REQUIRED.',
        required: true
      },
      revertOnFinish: {
        type: 'boolean',
        description:
          'When true, the flip is UNDONE automatically when the whole flow finishes — a change that lasts only as ' +
          'long as the flow does.',
        default: false,
        label: 'Revert changes after interaction'
      }
    }
  }
};

/** The built-in element callback for an action, or undefined when the action is not a known built-in (an
 *  element-type-specific/plugin callback whose schema is not knowable here). */
export const getElementCallback = (action: string): BuiltinElementCallback | undefined =>
  Object.hasOwn(BUILTIN_ELEMENT_CALLBACKS, action) ? BUILTIN_ELEMENT_CALLBACKS[action] : undefined;

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
