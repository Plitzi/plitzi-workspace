import type { BuiltinGlobalCallback } from '@plitzi/sdk-shared/authoring/builder';

/** What this source's actions are, for the editor that fills them in and for anything authoring one offline. */
export const stateCallbacks: Record<string, BuiltinGlobalCallback> = {
  setState: {
    source: 'state',
    title: 'Set State',
    strictParams: true,
    params: {
      key: {
        type: 'text',
        description: 'The state key/path to set. Stored under `runtime.state.<key>`.',
        default: ''
      },
      type: {
        type: 'select',
        description: 'The value type. What is stored is coerced to it — a boolean is a real boolean, not "true".',
        options: ['boolean', 'number', 'text'],
        optionLabels: { boolean: 'True / False', number: 'Numeric', text: 'Text' }
      },
      value: {
        // Polymorphic: the stored value is coerced to whatever `type` selects (boolean/number/text), so it may be a
        // real boolean or number, not only a string.
        type: 'scalar',
        description: 'The value to store — its type follows the `type` param (a real boolean/number, or text).',
        when: params => Boolean(params.type),
        builderType: params => (params.type === 'boolean' ? 'select' : 'text'),
        options: ['true', 'false']
      }
    }
  },
  /**
   * The one-step toggle — a menu that opens and closes, a panel that expands and collapses, from a single flow on a
   * single trigger.
   *
   * Written with `setState` this took two branches guarded by `when` conditions that had to be exact complements of
   * each other, and the condition read the state as it was when the flow STARTED — so the pattern worked only
   * because the second branch happened to see a stale value, and stopped working the moment anything else in the
   * flow touched the same key. Flipping the value where it is read is the only version of this that has no ordering
   * to get wrong.
   */
  toggleState: {
    source: 'state',
    title: 'Toggle State',
    strictParams: true,
    params: {
      key: {
        type: 'text',
        description:
          'The state key/path to flip, under `runtime.state.<key>`. Anything not already true is treated as ' +
          'false, so a key that has never been set toggles to true.',
        default: ''
      }
    }
  },
  clearState: {
    source: 'state',
    title: 'Clear State',
    strictParams: true,
    params: {}
  }
};
