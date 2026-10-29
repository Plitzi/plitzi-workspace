import { describe, expect, it } from 'vitest';

import { longTaskAttention } from './longTask';

import type { Message } from '../talk/messages';

const NOW = new Date('2026-10-27T18:55:00.000Z');
const ago = (minutes: number): string => new Date(NOW.getTime() - minutes * 60_000).toISOString();
const task = (takenMinutesAgo: number, checkedMinutes = 0, checking?: string) => ({
  id: 't-player-stalled',
  agent: 'dev-1',
  takenAt: ago(takenMinutesAgo),
  workedMs: (takenMinutesAgo - checkedMinutes) * 60_000,
  ...(checking ? { checking } : {}),
  spentMinutes: Math.round(takenMinutesAgo - checkedMinutes),
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

// A run asked dev-2 where it stood four minutes into its page's spec — and the question refused the complete that ran it.
describe('a card whose checks hold its agent', () => {
  it('counts only its agent’s own time, and asks nothing while a check runs', () => {
    expect(longTaskAttention(task(14, 5), [], NOW)).toBeUndefined();
    expect(longTaskAttention(task(16, 5), [], NOW)).toMatchObject({ kind: 'long-task' });
    expect(longTaskAttention(task(30, 0, ago(2)), [], NOW)).toBeUndefined();
  });

  it('reads an asking from after the limit its agent crossed, its checks’ time added back', () => {
    // 16 min taken, 5 of them checks: the limit was crossed 1 min ago — an asking 2 min ago was before it.
    expect(longTaskAttention(task(16, 5), [asked(2)], NOW)).toMatchObject({ kind: 'long-task', asks: 'dev-1' });
    expect(longTaskAttention(task(16, 5), [asked(0.5)], NOW)).toBeUndefined();
  });
});
