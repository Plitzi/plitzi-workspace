import { describe, expect, it } from 'vitest';

import { framesOf } from './frames';
import { shotFile } from './output';

describe('a picture’s file', () => {
  // encore-4: two clips of one page wrote home-1440-light.png each, the second over the first before it was read.
  it('names the page, the part clipped, the width and the theme', () => {
    expect(shotFile('/', undefined, 1440, 'light')).toBe('home-1440-light.png');
    expect(shotFile('/', 'site-header', 1440, 'light')).toBe('home-site-header-1440-light.png');
    expect(shotFile('/r/night-drive', '.room-desk-tabs', 390, 'dark')).toBe(
      'r-night-drive-room-desk-tabs-390-dark.png'
    );
  });
});

describe('what moved over the frames', () => {
  // encore-4: a pixel record turning in /design's motion grid — a few cells of a large clip — "moved nothing".
  it('counts any change of a part asked for, and says a page’s slight one apart', () => {
    expect(framesOf([{ name: 'motion-grid', changed: 0.2 }], false, 3, 300)).toEqual({
      count: 3,
      every: 300,
      moving: [{ name: 'motion-grid', changed: 0.2 }],
      slight: [],
      still: []
    });
    expect(
      framesOf(
        [
          { name: 'hero', changed: 0.3 },
          { name: 'footer', changed: 0 },
          { name: 'live', changed: 4 }
        ],
        true,
        3,
        300
      )
    ).toEqual({
      count: 3,
      every: 300,
      moving: [{ name: 'live', changed: 4 }],
      slight: [{ name: 'hero', changed: 0.3 }],
      still: ['hero', 'footer']
    });
  });
});
