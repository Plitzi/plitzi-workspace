import { useState } from 'react';

import { childOf, isBranch, valueAt } from '../helpers';

/** One path of the state changed as the canvas ran: from what, to what — in order, newest first. */
export type StateChange = { id: number; path: string; from: unknown; to: unknown };

/** How many of the last changes are kept: enough to follow a flow, few enough to read. */
const KEPT = 20;

/** Past this many paths changed under one key, the key is said changed whole: a list replaced is one change, not 200. */
const MOST_PER_KEY = 3;

/** The deepest paths where two values differ, until there are more than `MOST_PER_KEY` of them. */
const changedPaths = (from: unknown, to: unknown, path: string[], out: string[][]): void => {
  if (from === to || out.length > MOST_PER_KEY) {
    return;
  }

  if (isBranch(from) && isBranch(to) && Array.isArray(from) === Array.isArray(to)) {
    for (const key of new Set([...Object.keys(from), ...Object.keys(to)])) {
      changedPaths(childOf(from, key), childOf(to, key), [...path, key], out);
    }

    return;
  }

  out.push(path);
};

/**
 * The changes the state goes through while the panel is open, newest first — each at the path that changed
 * (`cart.total`, not the whole `cart`) — and the last change under each path and the paths above it, so a row can say it
 * or something under it moved. Worked out as the state arrives (no effect, no clock: a render is pure), so a change is
 * never shown a render late.
 */
const useStateChanges = (state: Record<string, unknown>) => {
  const [seen, setSeen] = useState(state);
  const [changes, setChanges] = useState<StateChange[]>([]);
  const [next, setNext] = useState(1);
  if (seen !== state) {
    const fresh: StateChange[] = [];
    for (const key of new Set([...Object.keys(seen), ...Object.keys(state)])) {
      const paths: string[][] = [];
      changedPaths(seen[key], state[key], [key], paths);
      for (const path of paths.length > MOST_PER_KEY ? [[key]] : paths) {
        fresh.push({
          id: next + fresh.length,
          path: path.join('.'),
          from: valueAt(seen[key], path.slice(1)),
          to: valueAt(state[key], path.slice(1))
        });
      }
    }

    setSeen(state);
    if (fresh.length > 0) {
      setNext(next + fresh.length);
      setChanges([...fresh.reverse(), ...changes].slice(0, KEPT));
    }
  }

  const lastOf = new Map<string, StateChange>();
  for (const change of changes) {
    const segments = change.path.split('.');
    for (let depth = 1; depth <= segments.length; depth += 1) {
      const path = segments.slice(0, depth).join('.');
      if (!lastOf.has(path)) {
        lastOf.set(path, change);
      }
    }
  }

  return { changes, lastOf, clear: () => setChanges([]) };
};

export default useStateChanges;
