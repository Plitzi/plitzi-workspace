import { describe, expect, it } from 'vitest';

import { longTaskAttention } from './longTask';

import type { Message } from '../talk/messages';

const NOW = new Date('2026-10-27T18:55:00.000Z');
const ago = (minutes: number): string => new Date(NOW.getTime() - minutes * 60_000).toISOString();
const task = (takenMinutesAgo: number) => ({
  id: 't-player-stalled',
  agent: 'dev-1',
  takenAt: ago(takenMinutesAgo),
  spentMinutes: Math.round(takenMinutesAgo),
  estimateMinutes: 10
});
const asked = (minutesAgo: number): Message => ({
  id: 'm1',
  from: 'lead',
  to: '@dev-1',
  text: 'Where do you stand?',
  at: ago(minutesAgo),
  asksStanding: true
});

// A card whose rounded minutes reached its limit half a minute early was asked 77 times in those 30 seconds: every
// asking read as from before the limit, and the next pass asked again.
describe('a card past its limit', () => {
  it('is past it by the clock, not by its rounded minutes — and asked once', () => {
    expect(longTaskAttention(task(9.6), [], NOW)).toBeUndefined();
    expect(longTaskAttention(task(10.2), [], NOW)).toMatchObject({ kind: 'long-task', asks: 'dev-1' });
    expect(longTaskAttention(task(10.2), [asked(0.1)], NOW)).toBeUndefined();
  });
});
