import { describe, expect, it } from 'vitest';

import { matchScore, paletteFound } from './monitorDialogs';

import type { PaletteItem } from './monitorDialogs';

const item = (label: string, hint = ''): PaletteItem => ({ group: 'Tasks', label, hint, action: { kind: 'quit' } });

describe("the monitor's command palette", () => {
  it('finds what has the letters typed in order, the closest first, and leaves out the rest', () => {
    expect(matchScore('thome', '◐ t-home')).toBeDefined();
    expect(matchScore('xyz', '◐ t-home')).toBeUndefined();
    expect(matchScore('', 'anything')).toBe(0);
    const found = paletteFound([item('◐ t-hero-overlay'), item('◐ t-home'), item('agent-2', 'on t-home')], 't-home');
    expect(found.map(each => each.label)).toEqual(['◐ t-home', 'agent-2']);
  });
});
