import { afterEach, describe, expect, it, vi } from 'vitest';

import { TtlCache } from './TtlCache';

const made: TtlCache<string>[] = [];

const cache = (...args: ConstructorParameters<typeof TtlCache<string>>): TtlCache<string> => {
  const created = new TtlCache<string>(...args);
  made.push(created);

  return created;
};

afterEach(() => {
  made.splice(0).forEach(created => created.destroy());
  vi.useRealTimers();
});

describe('TtlCache', () => {
  // The home page is stored first and asked for on every visit: dropping the oldest stored evicted exactly it.
  it('drops the entry used least recently, not the one stored first', () => {
    const pages = cache(60_000, 2);
    pages.set('home', 'a');
    pages.set('about', 'b');
    pages.get('home');
    pages.set('pricing', 'c');

    expect(pages.get('home')).toBe('a');
    expect(pages.get('about')).toBeUndefined();
    expect(pages.get('pricing')).toBe('c');
  });

  it('holds no more bytes than it is given, dropping the least recently used to make room', () => {
    const pages = cache(60_000, 100, { maxBytes: 10, sizeOf: value => value.length });
    pages.set('a', '1234');
    pages.set('b', '1234');
    pages.get('a');
    pages.set('c', '1234');

    expect(pages.bytes).toBe(8);
    expect(pages.get('a')).toBe('1234');
    expect(pages.get('b')).toBeUndefined();
  });

  // Space 5 was visited once; space 10 just got busy: its pages take the room of the one nobody asks for again.
  it('gives way first with what was asked for once, whichever space it is of', () => {
    const pages = cache(60_000, 100, { maxBytes: 12, sizeOf: value => value.length });
    pages.set('10:home', '1234');
    pages.get('10:home');
    pages.set('5:once', '1234');
    pages.set('10:a', '1234');
    pages.set('10:b', '1234');

    expect(pages.get('10:home')).toBe('1234');
    expect(pages.get('5:once')).toBeUndefined();
    expect(pages.isProtected('10:home')).toBe(true);
  });

  // A crawler walking every query string makes pages nobody asks for twice: they push out only each other.
  it('keeps what is asked for all the time through a burst of pages asked for once', () => {
    const pages = cache(60_000, 100, { maxBytes: 40, sizeOf: value => value.length });
    pages.set('home', '1234');
    pages.get('home');
    for (let i = 0; i < 50; i++) {
      pages.set(`?x=${String(i)}`, '1234');
    }

    expect(pages.get('home')).toBe('1234');
    expect(pages.bytes).toBeLessThanOrEqual(40);
  });

  // Two entries of 4 bytes are 8, past the 80% of 9 that the protected ones may hold.
  it('sends the protected entries past their share back to probation, the one used longest ago first', () => {
    const pages = cache(60_000, 100, { maxBytes: 9, sizeOf: value => value.length });
    pages.set('a', '1234');
    pages.get('a');
    pages.set('b', '1234');
    pages.get('b');

    expect(pages.isProtected('b')).toBe(true);
    expect(pages.isProtected('a')).toBe(false);
  });

  it('keeps the standing of an entry stored again', () => {
    const pages = cache(60_000, 100);
    pages.set('home', 'old');
    pages.get('home');
    pages.set('home', 'new');

    expect(pages.isProtected('home')).toBe(true);
  });

  it('keeps nothing of an entry larger than all it may hold, and drops nothing for it', () => {
    const pages = cache(60_000, 100, { maxBytes: 10, sizeOf: value => value.length });
    pages.set('a', '1234');
    pages.set('huge', '12345678901');

    expect(pages.get('huge')).toBeUndefined();
    expect(pages.get('a')).toBe('1234');
  });

  it('counts the bytes of an entry stored again once', () => {
    const pages = cache(60_000, 100, { maxBytes: 100, sizeOf: value => value.length });
    pages.set('a', '1234');
    pages.set('a', '12');

    expect(pages.bytes).toBe(2);
  });

  it('hands out an expired entry as stale for as long as it is told to, and nothing after', () => {
    vi.useFakeTimers();
    const pages = cache(1_000, 10, { staleMs: 500 });
    pages.set('home', 'a');

    vi.advanceTimersByTime(1_200);
    expect(pages.get('home')).toBeUndefined();
    expect(pages.read('home')).toMatchObject({ value: 'a', stale: true });

    vi.advanceTimersByTime(400);
    expect(pages.read('home')).toBeUndefined();
  });

  // A page read from a store several replicas share is as old as its render there, not as its arrival here.
  it('ages an entry from when it was made, when that is earlier than now', () => {
    vi.useFakeTimers();
    const pages = cache(1_000, 10, { staleMs: 1_000 });
    pages.set('home', 'a', Date.now() - 1_500);

    expect(pages.read('home')).toMatchObject({ stale: true });
  });
});
