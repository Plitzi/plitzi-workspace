import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useCommonStoreSetter } from '@plitzi/sdk-shared/store';

import StateInteractions from './StateInteractions';
import InteractionsContext from '../../InteractionsContext';

import type { InteractionsContextValue } from '../../InteractionsContext';
import type { InteractionCallback } from '@plitzi/sdk-shared';

vi.mock('@plitzi/sdk-shared/store', () => ({ useCommonStoreSetter: vi.fn() }));

/** Renders the source and hands back what a flow step would call, plus what it wrote. */
const mount = () => {
  const setState = vi.fn();
  vi.mocked(useCommonStoreSetter).mockReturnValue(setState);

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

  return { setState, call, wrote, run: (params: Record<string, unknown>) => call('setState', params) };
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

  it.each([
    ['appendState', { value: 'x' }],
    ['removeState', { index: '0' }]
  ])('writes nothing when %s is given no key', (action, params) => {
    const { call, setState } = mount();

    call(action, { key: '', ...params });

    expect(setState).not.toHaveBeenCalled();
  });
});
