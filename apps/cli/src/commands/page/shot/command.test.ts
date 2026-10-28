import { describe, expect, it } from 'vitest';

import { framesOf } from './frames';
import { eachOut, shotFile, smallPicture } from './output';

describe('a picture’s file', () => {
  // Two clips of one page wrote home-1440-light.png each, the second over the first before it was read.
  it('names the page, the part clipped, the width and the theme', () => {
    expect(shotFile('/', undefined, 1440, 'light')).toBe('home-1440-light.png');
    expect(shotFile('/', 'site-header', 1440, 'light')).toBe('home-site-header-1440-light.png');
    expect(shotFile('/r/night-drive', '.room-desk-tabs', 390, 'dark')).toBe(
      'r-night-drive-room-desk-tabs-390-dark.png'
    );
  });

  // /messages shot as mika wrote over /messages shot as dax a command before.
  it('names the account it was seen as', () => {
    expect(shotFile('/messages', undefined, 390, 'dark', 'mika')).toBe('messages-as-mika-390-dark.png');
    expect(shotFile('/messages', undefined, 390, 'dark', 'dax')).toBe('messages-as-dax-390-dark.png');
  });
});

// A lead pictured three pages in one command and was refused: each picture's --out names what tells it apart.
describe('the file --out names for each of several pictures', () => {
  it('adds the page when there are several, the width and the scheme when there are several of them', () => {
    const asked = { pages: 2, widths: 2, schemes: 1 };

    expect(eachOut('tmp/look.png', { route: '/', width: 1440 }, asked)).toBe('tmp/look-home-1440.png');
    expect(eachOut('tmp/look', { route: '/r/nope', width: 390 }, asked)).toBe('tmp/look-r-nope-390.png');
    expect(
      eachOut('look.png', { route: '/u/dax', width: 390, scheme: 'dark' }, { pages: 2, widths: 1, schemes: 2 })
    ).toBe('look-u-dax-dark.png');
  });
});

describe('what moved over the frames', () => {
  // A pixel record turning in /design's motion grid — a few cells of a large clip — "moved nothing".
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

// A run's designer clipped an 11px legend and got 350×26, its 1px hairline unseen: the picture's size and --scale said.
describe('a clip pictured small', () => {
  const pngOf = (width: number, height: number): Uint8Array => {
    const png = new Uint8Array(24);
    const view = new DataView(png.buffer);
    view.setUint32(16, width);
    view.setUint32(20, height);

    return png;
  };

  it('is said by its size under a few lines of text, and not past them', () => {
    expect(smallPicture(pngOf(350, 26))).toBe('350×26 px');
    expect(smallPicture(pngOf(350, 64))).toBeUndefined();
    expect(smallPicture(new Uint8Array(8))).toBeUndefined();
  });
});
