import { isDisabled } from './isDisabled';
import Subscribers from '../createStore/helpers/Subscribers';

import type { MiddlewareOptions, StoreChange, StoreMiddleware } from '../types';

// One recorded write: a monotonically increasing `seq` (so a consumer can ask for "everything after X" without
// timestamps colliding), the wall-clock `time`, the changed `path`, and the value at that path before/after.
export type RecorderEntry = {
  seq: number;
  time: number;
  path: string | undefined;
  prevValue: unknown;
  nextValue: unknown;
};

export type RecorderOptions<TState extends object> = MiddlewareOptions<TState> & {
  // Ring-buffer capacity; entries beyond this drop oldest-first. Default 100.
  max?: number;
};

export type Recorder<TState extends object> = {
  // Wire into `createStore({ middlewares: [recorder.middleware] })` (or a Provider's `middlewares`) to record that
  // store's committed writes.
  middleware: StoreMiddleware<TState>;
  // Record a change directly, bypassing the middleware. Lets one recorder collect from several stores (or hand-fed
  // events) — handy when the recorder is a shared singleton while the typed `middleware` only fits a single store.
  record: (change: Pick<StoreChange<TState>, 'path' | 'prevValue' | 'nextValue'>) => void;
  // Newest-last snapshot; a stable reference between records, so it satisfies `useSyncExternalStore` directly.
  getEntries: () => readonly RecorderEntry[];
  // Entries recorded after `seq` (exclusive) — for correlating writes with an external timeline (e.g. a render commit).
  entriesSince: (seq: number) => RecorderEntry[];
  // Highest `seq` recorded so far (0 when empty).
  lastSeq: () => number;
  // Notified after every record and on `clear`.
  subscribe: (listener: () => void) => () => void;
  clear: () => void;
};

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

// A ready-to-use change recorder: a bounded, subscribable log of committed store writes (path + before/after value) —
// the data layer a custom dev-tools "changes" panel can render directly, with no framework assumptions. Unlike
// `loggerMiddleware` (fire-and-forget to a sink) it retains recent history and lets a UI read/subscribe; unlike
// `reduxDevToolsMiddleware` it needs no browser extension. Per-store (not cascaded); wire it on the store to observe.
export const createRecorder = <TState extends object>(options: RecorderOptions<TState> = {}): Recorder<TState> => {
  const { max = 100, enabled } = options;
  const listeners = new Subscribers<() => void>();
  let entries: RecorderEntry[] = [];
  let seq = 0;

  const notify = (): void => {
    listeners.forEach(listener => listener());
  };

  const record = (change: Pick<StoreChange<TState>, 'path' | 'prevValue' | 'nextValue'>): void => {
    seq += 1;
    const entry: RecorderEntry = {
      seq,
      time: now(),
      path: change.path,
      prevValue: change.prevValue,
      nextValue: change.nextValue
    };
    // A fresh array every record keeps `getEntries` snapshot-stable for `useSyncExternalStore`.
    const next = entries.length >= max ? entries.slice(entries.length - max + 1) : entries.slice();
    next.push(entry);
    entries = next;
    notify();
  };

  const middleware: StoreMiddleware<TState> = api => {
    if (isDisabled(enabled, api.getState())) {
      return;
    }

    return { onChange: record };
  };

  return {
    middleware,
    record,
    getEntries: () => entries,
    entriesSince: since => entries.filter(entry => entry.seq > since),
    lastSeq: () => seq,
    subscribe: listener => listeners.add(listener),
    clear: () => {
      entries = [];
      notify();
    }
  };
};
