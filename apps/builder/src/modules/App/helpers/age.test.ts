import { describe, expect, it } from 'vitest';

import { ageAgo, shortAge } from './age';

const NOW = Date.parse('2026-11-16T12:00:00Z');
const ago = (seconds: number) => new Date(NOW - seconds * 1000).toISOString();

describe('shortAge', () => {
  it('says each age in a few characters, the largest unit that fits', () => {
    expect(shortAge(ago(20), NOW)).toBe('just now');
    expect(shortAge(ago(5 * 60), NOW)).toBe('5 min');
    expect(shortAge(ago(2 * 3600 + 59), NOW)).toBe('2 h');
    expect(shortAge(ago(3 * 86400), NOW)).toBe('3 d');
    expect(shortAge(ago(65 * 86400), NOW)).toBe('2 mo');
    expect(shortAge(ago(800 * 86400), NOW)).toBe('2 y');
  });

  it('says how long ago with its word, and a moment ago as just now', () => {
    expect(ageAgo(ago(3 * 86400), NOW)).toBe('3 d ago');
    expect(ageAgo(ago(10), NOW)).toBe('just now');
  });

  it('never says a moment ahead of now is in the future', () => {
    expect(shortAge(ago(-30), NOW)).toBe('just now');
  });
});
