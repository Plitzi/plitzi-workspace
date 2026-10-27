import { describe, expect, it } from 'vitest';

import { actionText } from './projectActions';

import type { ActionEntry } from '@plitzi/sdk-shared';

// A run's designer read the project's data and functions by hand to find who may run `host-close`: `explain` said "no
// name".
describe('an action of the project, explained', () => {
  it('says what it does, what runs it with what input, and its steps', () => {
    // A document as `actionsIn` reads one: its nodes carry only what the text reads.
    const action = {
      id: 'host-close',
      document: {
        name: 'Close the room',
        description: 'The host closes the room.',
        nodes: {
          start: {
            type: 'trigger',
            action: 'call',
            params: { access: 'session', input: '{"slug":{"type":"text","required":true}}' }
          },
          result: { type: 'task', action: 'host.close', params: {} },
          answer: { type: 'task', action: 'flow.output', params: {} }
        }
      }
    } as unknown as ActionEntry;

    expect(actionText(action).split('\n')).toEqual([
      'host-close — an action of this project (src/actions/): Close the room',
      '  The host closes the room.',
      '  Run by: call (session) — input: slug (text, required)',
      '  Its steps: host.close → flow.output',
      "  From a page's steps: page play <path> --steps 'action host-close {…}' (as the page's visitor)"
    ]);
  });
});
