import { stripVTControlCharacters } from 'node:util';

import { describe, expect, it } from 'vitest';

import { lookText } from './review';

type Looked = Parameters<typeof lookText>[0];

// encore-3: "No picture could be taken" alone left four reviewers to page through it themselves.
describe('a look that took no picture', () => {
  it('says why each was not taken', () => {
    // The few fields a look's text reads when nothing was pictured; the rest of a look is none of this test's.
    const looked = {
      task: 't-request-form',
      url: 'http://127.0.0.1:50000',
      ok: true,
      check: '✓ /r/night-drive at 1440 px',
      shots: [],
      unpictured: ['/r/night-drive room-request at 1440 light, beside the run before: room-request is not on the page'],
      timezone: 'UTC'
    } as unknown as Looked;
    const text = stripVTControlCharacters(lookText(looked));

    expect(text).toContain('No picture could be taken.');
    expect(text).toContain('Not pictured (1):');
    expect(text).toContain('room-request is not on the page');
  });
});
