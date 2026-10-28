import { describe, expect, it } from 'vitest';

import { ranText } from './click';

// A run's scout clicked a form's submit with four genres picked: "runServerAction success" while the server refused it.
describe('a flow that ran, in a line', () => {
  it('says a refused step with the server’s words, and every other step as it ended', () => {
    expect(
      ranText({
        at: '12:00:00.000',
        trigger: 'Submit [onSubmit]',
        on: 'rooms-new-form',
        status: 'completed',
        ms: 40,
        steps: [
          {
            title: 'made',
            action: 'runServerAction',
            status: 'refused',
            ms: 30,
            error: 'Pick 1 to 3 genres. (invalid_input)'
          },
          { title: 'Notice', action: 'addNotification', status: 'success', ms: 2 },
          { title: 'Go', action: 'navigate', status: 'skipped', ms: 0 }
        ]
      })
    ).toBe(
      'ran Submit [onSubmit] of rooms-new-form: runServerAction refused — Pick 1 to 3 genres. (invalid_input), addNotification success, navigate skipped'
    );
  });
});
