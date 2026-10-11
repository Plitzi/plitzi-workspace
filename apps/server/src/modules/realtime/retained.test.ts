import { describe, expect, it } from 'vitest';

import { createRealtimeRetained } from './retained';
import { createMemoryKv } from '../actions/runtime/memoryKv';

const SPACE = { spaceId: 1, environment: 'main' };

const said = (type: string, data: unknown, at: number) => ({ topic: 'desk', type, data, from: 'server', at });

describe('createRealtimeRetained', () => {
  /** Read, change, write back: two at once would each write the topic without the other's type. */
  it('keeps both of two types said at once', async () => {
    const retained = createRealtimeRetained(createMemoryKv());
    await Promise.all([retained.keep(SPACE, said('lists', ['milk'], 1)), retained.keep(SPACE, said('habits', 3, 2))]);

    expect((await retained.of(SPACE, 'desk')).map(({ type }) => type).sort()).toEqual(['habits', 'lists']);
  });

  it('answers the oldest first, and nothing for a topic of another space', async () => {
    const retained = createRealtimeRetained(createMemoryKv());
    await retained.keep(SPACE, said('later', 1, 20));
    await retained.keep(SPACE, said('sooner', 1, 10));

    expect((await retained.of(SPACE, 'desk')).map(({ type }) => type)).toEqual(['sooner', 'later']);
    expect(await retained.of({ spaceId: 2, environment: 'main' }, 'desk')).toEqual([]);
  });

  it('refuses a type past the most a topic keeps, naming the way out', async () => {
    const retained = createRealtimeRetained(createMemoryKv());
    for (let index = 0; index < 64; index += 1) {
      await retained.keep(SPACE, said(`part${String(index)}`, index, index));
    }

    await expect(retained.keep(SPACE, said('one-more', 1, 99))).rejects.toThrow('keeps at most 64 types');
  });
});
