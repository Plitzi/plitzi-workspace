import { describe, it, expect } from 'vitest';

import { createEntityAdapter } from './createEntityAdapter';
import createStore from '../createStore/createStore';

type Todo = { id: string; text: string; done: boolean };

const todo = (id: string, text = id, done = false): Todo => ({ id, text, done });

describe('createEntityAdapter — write operations', () => {
  const adapter = createEntityAdapter<Todo>();

  it('addOne adds, but ignores an id that already exists', () => {
    const map = adapter.addOne(todo('1', 'first'))({});
    const same = adapter.addOne(todo('1', 'again'))(map);

    expect(map['1'].text).toBe('first');
    expect(same).toBe(map); // no change → same reference
  });

  it('setOne replaces an existing entity', () => {
    const map = adapter.setOne(todo('1', 'a'))({ '1': todo('1', 'old') });

    expect(map['1'].text).toBe('a');
  });

  it('updateOne shallow-merges changes and is a no-op for an unknown id', () => {
    const base = adapter.addOne(todo('1'))({});
    const updated = adapter.updateOne({ id: '1', changes: { done: true } })(base);
    const missing = adapter.updateOne({ id: '404', changes: { done: true } })(base);

    expect(updated['1']).toEqual({ id: '1', text: '1', done: true });
    expect(missing).toBe(base);
  });

  it('upsertOne adds when missing and merges when present', () => {
    const added = adapter.upsertOne(todo('1', 'hi'))({});
    const merged = adapter.upsertOne({ id: '1', done: true } as Todo)(added);

    expect(added['1'].text).toBe('hi');
    expect(merged['1']).toEqual({ id: '1', text: 'hi', done: true });
  });

  it('setAll replaces the whole map; removeOne / removeMany / removeAll drop entries', () => {
    const map = adapter.setAll([todo('1'), todo('2'), todo('3')])({ old: todo('old') });
    expect(adapter.selectIds(map)).toEqual(['1', '2', '3']);

    expect(adapter.removeOne('2')(map)).toEqual({ '1': todo('1'), '3': todo('3') });
    expect(adapter.removeMany(['1', '3'])(map)).toEqual({ '2': todo('2') });
    expect(adapter.removeAll()(map)).toEqual({});
    expect(adapter.removeOne('404')(map)).toBe(map); // no change → same reference
  });

  it('never mutates the input map', () => {
    const base = adapter.addOne(todo('1'))({});
    const snapshot = JSON.stringify(base);

    adapter.updateOne({ id: '1', changes: { done: true } })(base);
    adapter.removeOne('1')(base);
    adapter.addOne(todo('2'))(base);

    expect(JSON.stringify(base)).toBe(snapshot);
  });
});

describe('createEntityAdapter — selectors and options', () => {
  it('selectAll / selectById / selectTotal read a map', () => {
    const adapter = createEntityAdapter<Todo>();
    const map = adapter.setAll([todo('1'), todo('2')])({});

    expect(adapter.selectTotal(map)).toBe(2);
    expect(adapter.selectById(map, '2')?.text).toBe('2');
    expect(adapter.selectById(map, '404')).toBeUndefined();
    expect(adapter.selectAll(map).map(t => t.id)).toEqual(['1', '2']);
  });

  it('honours a custom selectId and a sortComparer', () => {
    const adapter = createEntityAdapter<{ key: number; label: string }>({
      selectId: entity => entity.key,
      sortComparer: (a, b) => b.label.localeCompare(a.label)
    });
    const map = adapter.setAll([
      { key: 1, label: 'apple' },
      { key: 2, label: 'cherry' },
      { key: 3, label: 'banana' }
    ])({});

    expect(adapter.selectById(map, 2)?.label).toBe('cherry');
    expect(adapter.selectAll(map).map(e => e.label)).toEqual(['cherry', 'banana', 'apple']);
  });
});

describe('createEntityAdapter — store integration', () => {
  it('drives a normalized map through setState updaters', () => {
    const adapter = createEntityAdapter<Todo>();
    const store = createStore<{ todos: Record<string, Todo> }>({ todos: {} });

    store.setState('todos', adapter.addMany([todo('1'), todo('2')]));
    store.setState('todos', adapter.updateOne({ id: '1', changes: { done: true } }));

    expect(adapter.selectTotal(store.getPath('todos') ?? {})).toBe(2);
    expect(store.getPath('todos.1.done')).toBe(true);
  });
});
