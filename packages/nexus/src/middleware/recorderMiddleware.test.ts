import { describe, expect, it, vi } from 'vitest';

import { createRecorder } from './recorderMiddleware';
import createStore from '../createStore/createStore';

type AppState = { count: number; ui: { open: boolean } };
const initial = (): AppState => ({ count: 0, ui: { open: false } });

describe('createRecorder', () => {
  it('records each committed write with path and before/after value', () => {
    const recorder = createRecorder<AppState>();
    const store = createStore<AppState>(initial(), { middlewares: [recorder.middleware] });

    store.setState('count', 1);
    store.setState('ui.open', true);

    expect(
      recorder.getEntries().map(e => ({ seq: e.seq, path: e.path, prev: e.prevValue, next: e.nextValue }))
    ).toEqual([
      { seq: 1, path: 'count', prev: 0, next: 1 },
      { seq: 2, path: 'ui.open', prev: false, next: true }
    ]);
  });

  it('returns only entries after a given seq', () => {
    const recorder = createRecorder<AppState>();
    const store = createStore<AppState>(initial(), { middlewares: [recorder.middleware] });

    store.setState('count', 1);
    const mark = recorder.lastSeq();
    store.setState('count', 2);
    store.setState('count', 3);

    expect(recorder.entriesSince(mark).map(e => e.nextValue)).toEqual([2, 3]);
  });

  it('caps the buffer at `max`, dropping oldest first', () => {
    const recorder = createRecorder<AppState>({ max: 2 });
    const store = createStore<AppState>(initial(), { middlewares: [recorder.middleware] });

    store.setState('count', 1);
    store.setState('count', 2);
    store.setState('count', 3);

    expect(recorder.getEntries().map(e => e.nextValue)).toEqual([2, 3]);
    expect(recorder.lastSeq()).toBe(3);
  });

  it('notifies subscribers on record and clear, and getEntries is a stable reference between records', () => {
    const recorder = createRecorder<AppState>();
    const store = createStore<AppState>(initial(), { middlewares: [recorder.middleware] });
    const listener = vi.fn();
    recorder.subscribe(listener);

    store.setState('count', 1);
    const snapshot = recorder.getEntries();
    expect(snapshot).toBe(recorder.getEntries());

    recorder.clear();
    expect(recorder.getEntries()).toEqual([]);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('records full-state writes with an undefined path', () => {
    const recorder = createRecorder<AppState>();
    const store = createStore<AppState>(initial(), { middlewares: [recorder.middleware] });

    store.setState(undefined, { count: 9, ui: { open: true } });

    expect(recorder.getEntries()[0]).toMatchObject({ path: undefined, nextValue: { count: 9, ui: { open: true } } });
  });
});
