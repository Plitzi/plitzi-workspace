import { describe, expect, it } from 'vitest';

import { heldOn } from './inspect';

import type { Expectation } from './types';

const said = (element: string, path?: string): Expectation => ({ element, text: 'Listen', ...(path ? { path } : {}) });

// A scout's `page check /rooms --then /r/night-drive --expect room-player~Listen` failed on /rooms, which has no player.
describe('the expectations a page of a check is held to', () => {
  it('holds one naming no page on the page the visitor ends on, and one naming a page on that page', () => {
    const asked = [said('room-player'), said('explore-title', '/rooms')];

    expect(heldOn(asked, '/rooms', false)).toEqual([said('explore-title', '/rooms')]);
    expect(heldOn(asked, '/r/night-drive', true)).toEqual([said('room-player')]);
    expect(heldOn(asked, '/rooms', true)).toEqual(asked);
  });
});
