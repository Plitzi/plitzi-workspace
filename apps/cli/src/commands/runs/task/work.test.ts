import { stripVTControlCharacters } from 'node:util';

import { describe, expect, it } from 'vitest';

import { warningLines } from './work';

// Every complete of a run listed the same warnings, each "for this task to fix" — most in files it never touched.
describe('the warnings a complete says', () => {
  it('asks the task for those on its own files, and says the rest were there before it', () => {
    const lines = warningLines(
      [
        {
          name: 'lint:space',
          warnings: [
            'src/space/pages/home/venue.ts:12 colour-not-token',
            'src/space/artist/stats.ts:13 repeated-css',
            'src/space/pages/overlayObs.ts:27 colour-not-token'
          ]
        }
      ],
      ['src/space/pages/home/venue.ts']
    ).map(line => stripVTControlCharacters(line));

    expect(lines).toEqual([
      '  ⚠ lint:space warns: src/space/pages/home/venue.ts:12 colour-not-token — fix what this task brought, or tell the lead why it stays',
      '  · 2 warning(s) in files this task did not change — there before it: src/space/artist/stats.ts, src/space/pages/overlayObs.ts'
    ]);
  });
});
