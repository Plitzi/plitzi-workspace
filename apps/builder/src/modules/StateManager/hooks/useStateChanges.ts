import { useState } from 'react';

/** One key of the state changed as the canvas ran: from what, to what — in order, newest first. */
export type StateChange = { id: number; key: string; from: unknown; to: unknown };

/** How many of the last changes are kept: enough to follow a flow, few enough to read. */
const KEPT = 20;

const same = (a: unknown, b: unknown): boolean => a === b || JSON.stringify(a) === JSON.stringify(b);

/**
 * The changes the state goes through while the panel is open, newest first — each top-level key whose value is not
 * what it was — and the last change of each key, so its row can say it moved. Worked out as the state arrives (no
 * effect, no clock: a render is pure), so a change is never shown a render late.
 */
const useStateChanges = (state: Record<string, unknown>) => {
  const [seen, setSeen] = useState(state);
  const [changes, setChanges] = useState<StateChange[]>([]);
  const [next, setNext] = useState(1);
  if (seen !== state) {
    const keys = new Set([...Object.keys(seen), ...Object.keys(state)]);
    const fresh = [...keys]
      .filter(key => !same(seen[key], state[key]))
      .map((key, index) => ({ id: next + index, key, from: seen[key], to: state[key] }));
    setSeen(state);
    if (fresh.length > 0) {
      setNext(next + fresh.length);
      setChanges([...fresh.reverse(), ...changes].slice(0, KEPT));
    }
  }

  const lastOf = new Map<string, StateChange>();
  for (const change of changes) {
    if (!lastOf.has(change.key)) {
      lastOf.set(change.key, change);
    }
  }

  return { changes, lastOf, clear: () => setChanges([]) };
};

export default useStateChanges;
