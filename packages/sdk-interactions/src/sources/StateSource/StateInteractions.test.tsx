import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useCommonStoreSetter } from '@plitzi/sdk-shared/store';

import StateInteractions from './StateInteractions';
import InteractionsContext from '../../InteractionsContext';

import type { InteractionsContextValue } from '../../InteractionsContext';
import type { InteractionCallback } from '@plitzi/sdk-shared';

vi.mock('@plitzi/sdk-shared/store', () => ({ useCommonStoreSetter: vi.fn() }));

/** Renders the source and hands back what a flow step would call, plus what it wrote. */
const mount = (initial: Record<string, unknown> = {}) => {
  /**
   * A store that actually APPLIES the updaters, seeded with what the test says is already there.
   *
   * A mock that only records them is enough for a step that writes once, and not enough for one that reads before
   * it writes: `moveState` decides whether to touch the second list from what it found in the first, so against a
   * recording mock it always found nothing and the second write never happened — the test would have passed for an
   * implementation that does half the work.
   */
  const store: Record<string, unknown> = { ...initial };
  const setState = vi.fn((path: string, value: unknown) => {
    store[path] = typeof value === 'function' ? (value as (prev: unknown) => unknown)(store[path]) : value;
  });
  vi.mocked(useCommonStoreSetter).mockReturnValue(setState as unknown as ReturnType<typeof useCommonStoreSetter>);

  let registered: Record<string, InteractionCallback> = {};
  const interactions = {
    interactionsManager: {},
    useInteractions: ({ callbacks }: { callbacks?: Record<string, InteractionCallback> }) => {
      registered = callbacks ?? {};
    }
  } as unknown as InteractionsContextValue;

  render(
    <InteractionsContext value={interactions}>
      <StateInteractions />
    </InteractionsContext>
  );

  const call = (action: string, params: Record<string, unknown> = {}) =>
    (registered[action].callback as (values: Record<string, unknown>) => void)(params);

  /** What the store was asked to write at `path`, with the updater form already applied to `prev`. */
  const wrote = (path: string, prev: unknown): unknown => {
    const last = [...setState.mock.calls].reverse().find(call => call[0] === path);
    const value: unknown = last?.[1];

    return typeof value === 'function' ? (value as (previous: unknown) => unknown)(prev) : value;
  };

  /** What the store holds now, for the steps that read before they write. */
  const state = (path: string): unknown => store[path];

  return { setState, call, wrote, state, run: (params: Record<string, unknown>) => call('setState', params) };
};

describe('StateInteractions', () => {
  it('reads the words the builder writes', () => {
    const { run, setState } = mount();

    run({ key: 'done', type: 'boolean', value: 'true' });
    expect(setState).toHaveBeenCalledWith('runtime.state.done', true);

    run({ key: 'done', type: 'boolean', value: 'false' });
    expect(setState).toHaveBeenLastCalledWith('runtime.state.done', false);
  });

  /**
   * The regression this pins: a step interpolating `{{ someAction.output.done }}` hands over a real boolean, and
   * comparing that against the string turned every `true` into `false` — a flow that read as if it had worked.
   */
  it('keeps a boolean a flow already resolved', () => {
    const { run, setState } = mount();

    run({ key: 'done', type: 'boolean', value: true });
    expect(setState).toHaveBeenCalledWith('runtime.state.done', true);

    run({ key: 'done', type: 'boolean', value: false });
    expect(setState).toHaveBeenLastCalledWith('runtime.state.done', false);
  });

  it('coerces a number and leaves text alone', () => {
    const { run, setState } = mount();

    run({ key: 'count', type: 'number', value: '42' });
    expect(setState).toHaveBeenCalledWith('runtime.state.count', 42);

    run({ key: 'note', type: 'text', value: 'true' });
    expect(setState).toHaveBeenLastCalledWith('runtime.state.note', 'true');
  });
});

/**
 * The two operations a list needs. Without them a space could hold only the flags written into it when it was
 * authored — a checklist nobody using it could add to or take from, which is a poster with boxes on it.
 */
describe('a list in state', () => {
  it('appends to a key nobody has written yet, so a list needs no priming step', () => {
    const { call, wrote } = mount();

    call('appendState', { key: 'tasks', value: 'Ship the seed' });

    expect(wrote('runtime.state.tasks', undefined)).toEqual(['Ship the seed']);
  });

  /**
   * `unique` is for a list whose entries ARE their own identity: anything else referring to one refers to it by
   * value, so a second copy is indistinguishable from the first — and a checkbox over such a list ticks both, which
   * is exactly how this was found.
   */
  it('skips a value the list already holds when asked to', () => {
    const { call, state } = mount({ 'runtime.state.tasks': ['Call the client'] });

    call('appendState', { key: 'tasks', value: 'Call the client', unique: true });

    expect(state('runtime.state.tasks')).toEqual(['Call the client']);
  });

  it('reads the word the builder writes as well as the boolean', () => {
    const { call, state } = mount({ 'runtime.state.tasks': ['a'] });

    call('appendState', { key: 'tasks', value: 'a', unique: 'true' });

    expect(state('runtime.state.tasks')).toEqual(['a']);
  });

  // Off by default, because a list of things somebody typed may legitimately repeat.
  it('allows a repeat when nobody asked for uniqueness', () => {
    const { call, state } = mount({ 'runtime.state.tasks': ['a'] });

    call('appendState', { key: 'tasks', value: 'a' });

    expect(state('runtime.state.tasks')).toEqual(['a', 'a']);
  });

  /**
   * The answer for a list where two entries may legitimately read the same. Without an identity of its own, every
   * reference to an entry is a reference to its VALUE — so a checkbox over the list ticks both copies, which is
   * exactly how this was found: two tasks called the same thing, one tick, both struck through.
   */
  it('gives an entry an identity of its own when asked to', () => {
    const { call, state } = mount({ 'runtime.state.tasks': [] });

    call('appendState', { key: 'tasks', value: 'Call the client', withId: true });
    call('appendState', { key: 'tasks', value: 'Call the client', withId: true });
    const stored = state('runtime.state.tasks') as { id: string; value: string }[];

    expect(stored.map(entry => entry.value)).toEqual(['Call the client', 'Call the client']);
    expect(stored[0].id).not.toBe(stored[1].id);
    expect(stored[0].id).toBeTruthy();
  });

  it('appends to the end of what is already there', () => {
    const { call, wrote } = mount();

    call('appendState', { key: 'tasks', value: 'Second' });

    expect(wrote('runtime.state.tasks', ['First'])).toEqual(['First', 'Second']);
  });

  it('removes the entry at a position', () => {
    const { call, wrote } = mount();

    call('removeState', { key: 'tasks', index: '1' });

    expect(wrote('runtime.state.tasks', ['a', 'b', 'c'])).toEqual(['a', 'c']);
  });

  /**
   * The index arrives interpolated from a row, so it is a string — and a token that resolved to nothing arrives as
   * `''`, which `parseInt` reads as NaN. Removing "position NaN" matches nothing, and the guard is what keeps a
   * mis-authored token from being a list that empties itself on the first click.
   */
  it.each([
    ['a token that resolved to nothing', ''],
    ['something that is not a number at all', 'first']
  ])('removes nothing when the index is %s', (_label, index) => {
    const { call, setState } = mount();

    call('removeState', { key: 'tasks', index });

    expect(setState).not.toHaveBeenCalled();
  });

  it('leaves a key that is not a list alone rather than reading it as one', () => {
    const { call, wrote } = mount();

    call('removeState', { key: 'tasks', index: '0' });

    expect(wrote('runtime.state.tasks', 'not a list')).toEqual([]);
  });

  /**
   * By value, because a POSITION is only true until something before it moves — and a row's position is captured
   * when the row renders. This is the failure it was found by: pressing a row's button twice, which is what anybody
   * does to a control that seems not to have answered, acted on whatever had shifted into that slot.
   */
  it('removes every copy of a value, wherever it sits', () => {
    const { call, wrote } = mount();

    call('removeState', { key: 'tasks', value: 'b' });

    expect(wrote('runtime.state.tasks', ['a', 'b', 'c', 'b'])).toEqual(['a', 'c']);
  });

  /**
   * `by` names the field that carries the identity. Comparing records whole would never match anyway — two equal
   * objects are not the same object — so without it a list of records could only be emptied by position.
   */
  it('removes a record by the field that identifies it', () => {
    const { call, state } = mount({
      'runtime.state.tasks': [
        { id: 'a', value: 'Same words' },
        { id: 'b', value: 'Same words' }
      ]
    });

    call('removeState', { key: 'tasks', value: 'b', by: 'id' });

    expect(state('runtime.state.tasks')).toEqual([{ id: 'a', value: 'Same words' }]);
  });

  it('leaves a list of records alone when told to compare them whole', () => {
    const { call, state } = mount({ 'runtime.state.tasks': [{ id: 'a', value: 'x' }] });

    call('removeState', { key: 'tasks', value: 'a' });

    expect(state('runtime.state.tasks')).toEqual([{ id: 'a', value: 'x' }]);
  });

  it('prefers the value over a position when it is given both', () => {
    const { call, wrote } = mount();

    call('removeState', { key: 'tasks', value: 'c', index: '0' });

    expect(wrote('runtime.state.tasks', ['a', 'b', 'c'])).toEqual(['a', 'b']);
  });

  it.each([
    ['appendState', { value: 'x' }],
    ['removeState', { index: '0' }]
  ])('writes nothing when %s is given no key', (action, params) => {
    const { call, setState } = mount();

    call(action, { key: '', ...params });

    expect(setState).not.toHaveBeenCalled();
  });
});

/**
 * Moving between two lists, which is what a checkbox does.
 *
 * As an append beside a remove it was not idempotent, and the failure was easy to hit and hard to read: pressing the
 * box twice ran the pair twice, and the second run put the entry in both lists at once.
 */
describe('an entry moving between lists', () => {
  it('leaves the first list and joins the second', () => {
    const { call, state } = mount({ 'runtime.state.todo': ['a', 'b', 'c'], 'runtime.state.done': ['x'] });

    call('moveState', { from: 'todo', to: 'done', value: 'b' });

    expect(state('runtime.state.todo')).toEqual(['a', 'c']);
    expect(state('runtime.state.done')).toEqual(['x', 'b']);
  });

  it('does not touch the target when the entry is not in the source', () => {
    const { call, state } = mount({ 'runtime.state.todo': ['a'], 'runtime.state.done': ['x'] });

    call('moveState', { from: 'todo', to: 'done', value: 'ghost' });

    expect(state('runtime.state.todo')).toEqual(['a']);
    expect(state('runtime.state.done')).toEqual(['x']);
  });

  /**
   * The whole point. A second press finds nothing to move, so the entry cannot end up in both lists — which is what
   * "done" looked like before: the task listed under Done AND still sitting in the list above it.
   */
  it('cannot put the same entry in both lists, however many times it is pressed', () => {
    const { call, state } = mount({ 'runtime.state.todo': ['a', 'b'] });

    call('moveState', { from: 'todo', to: 'done', value: 'b' });
    call('moveState', { from: 'todo', to: 'done', value: 'b' });
    call('moveState', { from: 'todo', to: 'done', value: 'b' });

    expect(state('runtime.state.todo')).toEqual(['a']);
    expect(state('runtime.state.done')).toEqual(['b']);
  });

  it('moves it back the same way, so a box can be unticked', () => {
    const { call, state } = mount({ 'runtime.state.todo': ['a'], 'runtime.state.done': ['b'] });

    call('moveState', { from: 'done', to: 'todo', value: 'b' });

    expect(state('runtime.state.done')).toEqual([]);
    expect(state('runtime.state.todo')).toEqual(['a', 'b']);
  });

  it('starts a list that is not there yet', () => {
    const { call, state } = mount({ 'runtime.state.todo': ['b'] });

    call('moveState', { from: 'todo', to: 'done', value: 'b' });

    expect(state('runtime.state.done')).toEqual(['b']);
  });

  it.each([
    ['no source list', { from: '', to: 'done', value: 'b' }],
    ['no target list', { from: 'todo', to: '', value: 'b' }],
    ['a value that resolved to nothing', { from: 'todo', to: 'done', value: '' }]
  ])('writes nothing when given %s', (_label, params) => {
    const { call, setState } = mount({ 'runtime.state.todo': ['b'] });

    call('moveState', params);

    expect(setState).not.toHaveBeenCalled();
  });
});

/**
 * The checkbox. Pressing it twice has to leave the list exactly as it started, and adding the same value twice has
 * to be impossible — that is the difference between a set and a list, and the whole reason this is one step.
 */
describe('a checkbox over a list', () => {
  it('puts the value in when it is not there', () => {
    const { call, state } = mount({ 'runtime.state.done': ['a'] });

    call('toggleInState', { key: 'done', value: 'b' });

    expect(state('runtime.state.done')).toEqual(['a', 'b']);
  });

  it('takes it out again when it is', () => {
    const { call, state } = mount({ 'runtime.state.done': ['a', 'b'] });

    call('toggleInState', { key: 'done', value: 'b' });

    expect(state('runtime.state.done')).toEqual(['a']);
  });

  it('leaves the list as it found it after two presses', () => {
    const { call, state } = mount({ 'runtime.state.done': ['a'] });

    call('toggleInState', { key: 'done', value: 'b' });
    call('toggleInState', { key: 'done', value: 'b' });

    expect(state('runtime.state.done')).toEqual(['a']);
  });

  it('starts a list that is not there yet', () => {
    const { call, state } = mount();

    call('toggleInState', { key: 'done', value: 'b' });

    expect(state('runtime.state.done')).toEqual(['b']);
  });

  it.each([
    ['no key', { key: '', value: 'b' }],
    ['a value that resolved to nothing', { key: 'done', value: '' }]
  ])('writes nothing when given %s', (_label, params) => {
    const { call, setState } = mount();

    call('toggleInState', params);

    expect(setState).not.toHaveBeenCalled();
  });
});

/**
 * "Start again", for one list or for everything.
 *
 * The key form exists because a page that keeps notes beside a list would otherwise have to lose the notes to clear
 * the list — and because a list whose stored entries no longer match what the space expects has to be recoverable
 * from the page itself, not from a browser's developer tools.
 */
describe('clearing state', () => {
  it('empties the named list and leaves everything else alone', () => {
    const { call, state } = mount({
      'runtime.state.tasks': [{ id: 'a', value: 'x' }],
      'runtime.state.focus': 'Ship it'
    });

    call('clearState', { key: 'tasks' });

    expect(state('runtime.state.tasks')).toEqual([]);
    expect(state('runtime.state.focus')).toBe('Ship it');
  });

  it('empties everything when no key is named', () => {
    const { call, state } = mount({ 'runtime.state.tasks': ['x'] });

    call('clearState', {});

    expect(state('runtime.state')).toEqual({});
  });
});
