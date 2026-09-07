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
  /**
   * A list somebody using the space can add to, which `setState` cannot do: it stores a scalar at a path, so the
   * only lists a space could hold were the ones written into it when it was authored.
   */
  appendState: {
    source: 'state',
    title: 'Append To State',
    strictParams: true,
    params: {
      key: {
        type: 'text',
        description: 'The state key/path holding the list, under `runtime.state.<key>`. Created if it is not there.',
        default: ''
      },
      value: {
        type: 'scalar',
        description: 'What to add to the end of the list.',
        default: ''
      },
      unique: {
        type: 'boolean',
        description:
          'Skip the append when the list already holds this value. For a list whose entries are their own ' +
          'identity — anything referring to one refers to it by value, so a second copy is indistinguishable.',
        default: false
      }
    }
  },
  removeState: {
    source: 'state',
    title: 'Remove From State',
    strictParams: true,
    params: {
      key: {
        type: 'text',
        description: 'The state key/path holding the list, under `runtime.state.<key>`.',
        default: ''
      },
      value: {
        type: 'scalar',
        description:
          'The entry to drop, by value — every copy of it. Prefer this wherever the list can change under the ' +
          'person: a position is only true until something before it moves.',
        default: ''
      },
      index: {
        type: 'text',
        description:
          'Which entry to drop, by position, when there is no value to go on. Inside a controlled list, ' +
          '`{{ <listSource>.index }}` is the row own position. An index that resolves to nothing removes nothing.',
        default: ''
      }
    }
  },
  /**
   * The operation a checkbox needs: move an entry between two lists, and do nothing if it is not in the first.
   *
   * As an append beside a remove it was not idempotent — pressing the box twice ran the pair twice and the second
   * run put the entry in both lists at once. One step that finds nothing to move is the whole of the fix.
   */
  moveState: {
    source: 'state',
    title: 'Move Between Lists',
    strictParams: true,
    params: {
      from: { type: 'text', description: 'The list to take it out of, under `runtime.state.<key>`.', default: '' },
      to: { type: 'text', description: 'The list to put it into. It is not added twice.', default: '' },
      value: {
        type: 'scalar',
        description: 'The entry to move. Absent from `from` means nothing happens.',
        default: ''
      }
    }
  },
  /**
   * A checkbox, as one step: in the list if it was not, out of it if it was.
   *
   * The list is treated as a SET — the same value is never in it twice — which is what makes pressing the box twice
   * safe. An append guarded by a check reads the list as it was when the flow started, so two presses in the same
   * tick both found the value absent and added it twice.
   */
  toggleInState: {
    source: 'state',
    title: 'Toggle In List',
    strictParams: true,
    params: {
      key: { type: 'text', description: 'The list to add to or drop from, under `runtime.state.<key>`.', default: '' },
      value: { type: 'scalar', description: 'The entry the box stands for.', default: '' }
    }
  },
  clearState: {
    source: 'state',
    title: 'Clear State',
    strictParams: true,
    params: {}
  }
};
