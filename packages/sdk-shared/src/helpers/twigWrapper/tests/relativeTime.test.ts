import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { processTwig } from '../index';

// "Ended 4 min ago" took a plugin, and a track's 238 s read through `date` printed 06:40.
describe('processTwig — a moment as how long ago, a length as a clock', () => {
  const now = Date.UTC(2026, 9, 24, 12, 0, 0);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('says how long ago, or how far ahead, by the largest whole unit — an epoch in ms or s, or an ISO date', () => {
    expect(processTwig('{{ at|ago }}', { at: now - 4 * 60_000 })).toBe('4 minutes ago');
    expect(processTwig('{{ at|ago }}', { at: (now - 3 * 3_600_000) / 1000 })).toBe('3 hours ago');
    expect(processTwig('{{ at|ago }}', { at: now + 2 * 86_400_000 })).toBe('in 2 days');
    expect(processTwig('{{ at|ago }}', { at: new Date(now - 86_400_000).toISOString() })).toBe('yesterday');
    expect(processTwig('{{ at|ago }}', { at: now - 3000 })).toBe('now');
    expect(processTwig("{{ at|ago('es') }}", { at: now - 4 * 60_000 })).toBe('hace 4 minutos');
    expect(processTwig('{{ at|ago }}', { at: 'not a date' })).toBe('');
  });

  it('writes a length in seconds as a clock', () => {
    expect(processTwig('{{ seconds|duration }}', { seconds: 238 })).toBe('3:58');
    expect(processTwig('{{ seconds|duration }}', { seconds: 3723 })).toBe('1:02:03');
    expect(processTwig('{{ seconds|duration }}', { seconds: '59.6' })).toBe('1:00');
    expect(processTwig('{{ seconds|duration }}', { seconds: -1 })).toBe('');
  });
});
