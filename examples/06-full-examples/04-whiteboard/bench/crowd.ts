import { connect } from '../src/agent/connection.ts';
import { callAction, doorTo } from '../src/agent/session.ts';
import { drawing } from '../src/board/sketch.ts';

import type { Connection } from '../src/agent/connection.ts';

/**
 * A crowd on a board: connections that join its room as a page does — presence, a cursor twenty times a second —
 * and, for some of them, a change every few seconds through `board-apply`, the way people add to a board while
 * others watch. Every member also listens to the board's channel, which is how the crowd measures what it takes
 * for a change to reach everybody: from the commit being sent to the last member hearing it.
 */

export type Crowd = {
  /** What a change took to reach every member, in ms — one entry per change the crowd made. */
  fanOut: number[];
  /** What `board-apply` took to answer, in ms. */
  commits: number[];
  /** Commits the server refused — its rate limit, for one. */
  refused: number;
  stop: () => void;
};

const NAMES = ['Ada', 'Grace', 'Alan', 'Edsger', 'Barbara', 'Donald', 'Radia', 'Ken', 'Margaret', 'Tim'];

/** The grants a board's channels are opened with, as `board-open` answers them — or none, where it did not. */
const grantsOf = (opened: unknown): string[] => {
  const grants = typeof opened === 'object' && opened !== null && 'grants' in opened ? opened.grants : undefined;
  if (typeof grants !== 'object' || grants === null) {
    return [];
  }

  return Object.values(grants).filter(grant => typeof grant === 'string');
};

/** Twenty times a second: what a page sends while its pointer moves. */
const POINTER_MS = 50;

export const startCrowd = async (
  origin: string,
  board: string,
  size: number,
  { writers, commitEveryMs }: { writers: number; commitEveryMs: number }
): Promise<Crowd> => {
  const fanOut: number[] = [];
  const commits: number[] = [];
  let refused = 0;
  /** A committed element's id → when it was sent, and how many members have heard it. */
  const pending = new Map<string, { sentAt: number; heard: number }>();
  const hear = (data: unknown) => {
    if (!Array.isArray(data)) {
      return;
    }

    const elements: readonly unknown[] = data;
    for (const element of elements) {
      const id = typeof element === 'object' && element !== null && 'id' in element ? element.id : undefined;
      const entry = typeof id === 'string' ? pending.get(id) : undefined;
      if (!entry || typeof id !== 'string') {
        continue;
      }

      entry.heard += 1;
      if (entry.heard === size) {
        fanOut.push(Date.now() - entry.sentAt);
        pending.delete(id);
      }
    }
  };

  // One opening for the whole crowd: a grant opens its topic for whoever holds it, as a page's does for every tab.
  const grants = grantsOf(await callAction(doorTo(origin), 'board-open', { id: board, password: '', key: '' }));
  const members: Connection[] = await Promise.all(
    Array.from({ length: size }, () =>
      connect(origin, [`room:${board}`, `board:${board}`], grants, heard => {
        if (heard.topic === `board:${board}` && heard.type === 'elements') {
          hear(heard.data);
        }
      })
    )
  );
  members.forEach((member, index) =>
    member.announce(`room:${board}`, { name: `${NAMES[index % NAMES.length]} ${index + 1}`, color: 'indigo' })
  );

  const timers: ReturnType<typeof setInterval>[] = [];
  members.forEach((member, index) => {
    let angle = index;
    timers.push(
      setInterval(() => {
        angle += 0.08;
        void member.publish(`room:${board}`, 'pointer', {
          x: Math.round(Math.cos(angle) * 600 + index * 7),
          y: Math.round(Math.sin(angle) * 400),
          draft: null,
          selection: [],
          view: { x: -700, y: -450, width: 1400, height: 900 },
          chat: ''
        });
      }, POINTER_MS)
    );
  });

  members.slice(0, writers).forEach((_, index) => {
    let count = 0;
    timers.push(
      setInterval(() => {
        count += 1;
        const [element] = drawing([
          { type: 'sticky', x: index * 230, y: -600 - count * 10, width: 200, height: 200, text: `From ${index}` }
        ]);
        const sentAt = Date.now();
        pending.set(element.id, { sentAt, heard: 0 });
        callAction(doorTo(origin), 'board-apply', { board, ops: [element], key: '' })
          .then(() => commits.push(Date.now() - sentAt))
          .catch(() => {
            refused += 1;
            pending.delete(element.id);
          });
      }, commitEveryMs)
    );
  });

  return {
    fanOut,
    commits,
    get refused() {
      return refused;
    },
    stop: () => {
      timers.forEach(clearInterval);
      members.forEach(member => member.close());
    }
  };
};
