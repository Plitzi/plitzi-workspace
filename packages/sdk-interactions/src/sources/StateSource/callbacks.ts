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
  clearState: {
    source: 'state',
    title: 'Clear State',
    strictParams: true,
    params: {}
  }
};
