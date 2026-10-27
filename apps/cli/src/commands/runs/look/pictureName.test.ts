import { describe, expect, it } from 'vitest';

import { pictureName } from './pictureName';

describe('a look’s picture name', () => {
  // A path looked at as a guest and again as an account wrote the same pictures, the second over the first.
  it('says who read the page, so two visitors of one path keep both', () => {
    const at = { task: 't-claps-stage', route: '/r/night-drive', width: '1440', scheme: 'light' };

    expect(pictureName(at)).toBe('t-claps-stage-r-night-drive-1440-light.png');
    expect(pictureName({ ...at, guest: true })).toBe('t-claps-stage-r-night-drive-guest-1440-light.png');
    expect(pictureName({ ...at, as: 'mika', clip: 'room-stage', after: true })).toBe(
      't-claps-stage-r-night-drive-as-mika-room-stage-1440-light-after.png'
    );
    expect(pictureName({ ...at, route: '/' })).toBe('t-claps-stage-home-1440-light.png');
  });
});
