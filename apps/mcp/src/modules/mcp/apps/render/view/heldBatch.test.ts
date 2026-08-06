import { describe, expect, it, vi } from 'vitest';

import { readHeldBatch, writeHeldBatch } from './heldBatch';

/** The batch store is the only place a rendered widget survives between tool calls, so a patch is worth exactly
 *  what this keeps: the host gives each call its own view, and everything it held in memory is gone. */

const fakeStore = (limitBytes = Infinity): Storage => {
  const entries = new Map<string, string>();

  return {
    get length() {
      return entries.size;
    },
    key: index => [...entries.keys()][index] ?? null,
    getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => {
      const total = [...entries].reduce((sum, [k, v]) => (k === key ? sum : sum + k.length + v.length), 0);
      if (total + key.length + value.length > limitBytes) {
        throw new DOMException('QuotaExceededError');
      }

      entries.set(key, value);
    },
    removeItem: key => {
      entries.delete(key);
    },
    clear: () => entries.clear()
  };
};

const opsOf = (count: number): unknown[] => Array.from({ length: count }, (_unused, index) => ({ index }));

describe('held batch store', () => {
  it('gives a later call back the batch its widget was built from', () => {
    const store = fakeStore();
    writeHeldBatch('r1', opsOf(3), store);

    expect(readHeldBatch('r1', store)).toHaveLength(3);
  });

  it('knows nothing about a widget it never stored, instead of guessing at another one', () => {
    const store = fakeStore();
    writeHeldBatch('r1', opsOf(3), store);

    expect(readHeldBatch('r2', store)).toBeUndefined();
  });

  it('treats a corrupted entry as absent, so a patch degrades to a full re-render', () => {
    const store = fakeStore();
    store.setItem('plitzi.render.r1', '{ not json');

    expect(readHeldBatch('r1', store)).toBeUndefined();
  });

  it('keeps the recent widgets patchable and lets the oldest go', () => {
    const store = fakeStore();
    const start = Date.now();
    const now = vi.spyOn(Date, 'now');
    for (let index = 1; index <= 7; index += 1) {
      now.mockReturnValue(start + index * 1000);
      writeHeldBatch(`r${index}`, opsOf(1), store);
    }

    now.mockRestore();
    expect(readHeldBatch('r7', store)).toBeDefined();
    expect(readHeldBatch('r3', store)).toBeDefined();
    expect(readHeldBatch('r2', store)).toBeUndefined();
    expect(readHeldBatch('r1', store)).toBeUndefined();
  });

  it('sacrifices the older widgets rather than the one just rendered when storage is full', () => {
    // Room for one batch of this size and not two.
    const store = fakeStore(200);
    writeHeldBatch('r1', opsOf(6), store);
    writeHeldBatch('r2', opsOf(6), store);

    expect(readHeldBatch('r2', store)).toHaveLength(6);
    expect(readHeldBatch('r1', store)).toBeUndefined();
  });

  it('forgets a widget nobody came back to, so an abandoned conversation leaves nothing behind', () => {
    const store = fakeStore();
    const start = Date.now();
    const now = vi.spyOn(Date, 'now');
    now.mockReturnValue(start);
    writeHeldBatch('r1', opsOf(2), store);

    now.mockReturnValue(start + 8 * 24 * 60 * 60 * 1000);
    expect(readHeldBatch('r1', store)).toBeUndefined();

    // And the next write is what actually collects it: no timers, nothing running in the background.
    writeHeldBatch('r2', opsOf(2), store);
    now.mockRestore();
    expect(store.getItem('plitzi.render.r1')).toBeNull();
  });

  it('stays silent on a host that grants no storage', () => {
    expect(() => writeHeldBatch('r1', opsOf(1), undefined)).not.toThrow();
    expect(readHeldBatch('r1', undefined)).toBeUndefined();
  });
});
