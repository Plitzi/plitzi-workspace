import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createPresenceAnnouncer, LEFT_GRACE_MS } from './presenceAnnouncer';

import type { PresenceAnnouncement } from './presenceAnnouncer';

const ada = { instanceId: 'tab-ada' };
const otherTab = { instanceId: 'tab-admin-2' };

const setUp = () => {
  const said: [string, PresenceAnnouncement][] = [];
  const announcer = createPresenceAnnouncer<{ instanceId: string }>((collaborator, announcement) =>
    said.push([collaborator.instanceId, announcement])
  );

  return { announcer, said };
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('what presence is said', () => {
  it('says who joins, once', () => {
    const { announcer, said } = setUp();

    announcer.connected(ada);
    announcer.connected(ada);

    expect(said).toEqual([['tab-ada', 'joined']]);
  });

  /**
   * A server that restarted closed every socket at once, and each builder that came back announced itself again:
   * "admin joined" for an admin who had never left — another tab of your own among them.
   */
  it('says nothing when the ones already here reconnect after the server restarted', () => {
    const { announcer, said } = setUp();
    announcer.present([ada, otherTab]);

    // The server's shutdown releases every lease, then each socket comes back.
    announcer.disconnected(ada);
    announcer.disconnected(otherTab);
    announcer.connected(otherTab);
    announcer.present([otherTab]);
    announcer.connected(ada);
    vi.advanceTimersByTime(LEFT_GRACE_MS * 2);

    expect(said).toEqual([]);
  });

  it('says who left once they have not come back, and their return is a join again', () => {
    const { announcer, said } = setUp();
    announcer.present([ada]);

    announcer.disconnected(ada);
    vi.advanceTimersByTime(LEFT_GRACE_MS - 1);
    expect(said).toEqual([]);

    vi.advanceTimersByTime(1);
    announcer.connected(ada);

    expect(said).toEqual([
      ['tab-ada', 'left'],
      ['tab-ada', 'joined']
    ]);
  });

  it('says nothing more once disposed', () => {
    const { announcer, said } = setUp();
    announcer.present([ada]);

    announcer.disconnected(ada);
    announcer.dispose();
    vi.advanceTimersByTime(LEFT_GRACE_MS);

    expect(said).toEqual([]);
  });
});
