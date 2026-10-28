import { describe, expect, it } from 'vitest';

import { broughtBy } from './plan';

import type { Ownership } from '../copies/ownership';

// A stage of 8 files opened with 12: the scout read the four a page's unit brought as added for no reason.
describe('the files a task holds beyond those it names', () => {
  it('names each with the unit that owns it', () => {
    const ownership: Pick<Ownership, 'units'> = {
      units: [
        {
          unit: 'src/space/pages/rooms-new.ts',
          owns: [
            'src/space/pages/rooms-new.ts',
            'src/space/pages/rooms-new/controls.ts',
            'src/space/pages/rooms-new/styles.ts'
          ],
          reaches: []
        },
        {
          unit: 'src/space/pages/rooms.ts',
          owns: ['src/space/pages/rooms.ts', 'src/space/pages/rooms/list.ts'],
          reaches: []
        }
      ]
    };
    const named = ['src/space/pages/rooms-new.ts', 'src/space/room/claps.ts'];
    const held = [...named, 'src/space/pages/rooms-new/controls.ts', 'src/space/pages/rooms-new/styles.ts'];

    expect(broughtBy(ownership, named, held)).toEqual([
      {
        unit: 'src/space/pages/rooms-new.ts',
        files: ['src/space/pages/rooms-new/controls.ts', 'src/space/pages/rooms-new/styles.ts']
      }
    ]);
  });
});
