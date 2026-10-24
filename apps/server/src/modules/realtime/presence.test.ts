import { describe, expect, it } from 'vitest';

import { createRealtimePresence, PRESENCE_STALE_MS } from './presence';
import { createMemoryKv } from '../actions/runtime/memoryKv';

const space = { spaceId: 7, environment: 'main' };

/**
 * Who is on a presence channel, as every replica sees it: one store, the replicas' heartbeats keeping their members,
 * and a member nobody has seen within `PRESENCE_STALE_MS` gone — its replica went down without a word.
 */
describe('a presence channel’s members, shared', () => {
  it('counts the pages of every replica, the earliest first, and lets one go when it leaves', async () => {
    let now = 1_000;
    const store = createMemoryKv();
    const one = createRealtimePresence(store, () => now);
    const other = createRealtimePresence(store, () => now);

    await one.touch(space, 'room:night-drive', [{ from: 'a', user: { id: 1, name: 'mika' }, since: now }]);
    now += 10;
    await other.touch(space, 'room:night-drive', [{ from: 'b', since: now }]);

    expect(await one.of(space, 'room:night-drive')).toEqual([
      { from: 'a', user: { id: 1, name: 'mika' }, since: 1_000 },
      { from: 'b', since: 1_010 }
    ]);

    await other.depart(space, 'room:night-drive', 'a');
    expect((await one.of(space, 'room:night-drive')).map(member => member.from)).toEqual(['b']);
    expect(await one.of(space, 'room:bass-lab')).toEqual([]);
  });

  it('keeps a member its replica still sees, and drops one whose replica stopped saying so', async () => {
    let now = 1_000;
    const presence = createRealtimePresence(createMemoryKv(), () => now);
    await presence.touch(space, 'room:x', [
      { from: 'kept', since: now },
      { from: 'ghost', since: now }
    ]);

    now += PRESENCE_STALE_MS - 1_000;
    await presence.touch(space, 'room:x', [{ from: 'kept', since: now }]);
    now += 2_000;

    expect(await presence.of(space, 'room:x')).toEqual([{ from: 'kept', since: 1_000 }]);
  });
});
