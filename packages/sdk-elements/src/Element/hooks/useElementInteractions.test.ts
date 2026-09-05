import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import useElementInteractions from './useElementInteractions';

import type { UseElementInteractionsProps } from './useElementInteractions';
import type { Element, InteractionCallbackParamValues, InteractionPostCallback } from '@plitzi/sdk-shared';

const definition: Element['definition'] = {
  rootId: 'root',
  label: 'Button',
  type: 'button',
  styleSelectors: { base: 'btn' }
};

// The shared InteractionCallback type returns `unknown`; this hook returns { prevState, nextState } (undefined on a
// no-op, when nothing was written).
type SetStateResult = {
  prevState: Record<string, unknown> | undefined;
  nextState: Record<string, unknown> | undefined;
};
type SetStateCallback = (params: InteractionCallbackParamValues) => SetStateResult;
type Updater = (prev: Record<string, unknown>) => Record<string, unknown>;

// The real `setElementState` applies a value or a functional updater against the live store slice. The mock mirrors
// that so the hook can read `prev` and chain writes — the whole point of dropping the shadow ref.
const setup = () => {
  let state: Record<string, unknown> = {};
  const setElementState = vi.fn((value?: Record<string, unknown> | Updater) => {
    state = typeof value === 'function' ? value(state) : (value ?? {});

    return true;
  });
  const { result } = renderHook(() =>
    useElementInteractions({
      attributes: { text: 'hi' },
      definition,
      setElementState: setElementState as unknown as UseElementInteractionsProps['setElementState']
    })
  );
  const callback = result.current.setState.callback as SetStateCallback;
  const postCallback = result.current.setState.postCallback as InteractionPostCallback;
  const toggle = result.current.toggleState.callback as SetStateCallback;

  return { callback, postCallback, toggle, setElementState, getState: () => state };
};

describe('useElementInteractions', () => {
  it('coerces "true"/"false" strings to booleans before setting state', () => {
    const { callback, getState } = setup();

    const { nextState } = callback({ key: 'active', value: 'true' });

    expect(nextState).toEqual({ active: true });
    expect(getState()).toEqual({ active: true });
  });

  it('coerces "yes"/"no" strings to booleans', () => {
    const { callback } = setup();

    expect(callback({ key: 'active', value: 'no' }).nextState).toEqual({ active: false });
  });

  it('keeps non-boolean strings as-is and sets nested keys', () => {
    const { callback } = setup();

    expect(callback({ key: 'a.b', value: 'hello' }).nextState).toEqual({ a: { b: 'hello' } });
  });

  it('writes nothing and reports no change when key or value is missing', () => {
    const { callback, setElementState } = setup();

    const { prevState, nextState } = callback({ key: 'active' });

    expect(prevState).toBeUndefined();
    expect(nextState).toBeUndefined();
    expect(setElementState).not.toHaveBeenCalled();
  });

  // A falsy value is a value. Guarding it the way a missing key is guarded made every step that hid an element or
  // unset a flag a silent no-op, which is the half of a toggle that turns something off.
  it.each([
    ['a real false', false, false],
    ['zero', 0, 0],
    ['an empty string', '', '']
  ])('writes %s rather than treating it as no value', (_label, value, expected) => {
    const { callback, getState } = setup();

    callback({ key: 'active', value });

    expect(getState()).toEqual({ active: expected });
  });

  it('tracks the previous state across successive calls', () => {
    const { callback } = setup();

    callback({ key: 'a', value: 'true' });
    const second = callback({ key: 'b', value: 'true' });

    expect(second.prevState).toEqual({ a: true });
    expect(second.nextState).toEqual({ a: true, b: true });
  });

  it('reverts to the previous state in the post-callback when revertOnFinish is set', () => {
    const { postCallback, setElementState } = setup();

    postCallback({ revertOnFinish: true }, { prevState: { a: 1 } });

    expect(setElementState).toHaveBeenCalledWith({ a: 1 });
  });

  it('does nothing in the post-callback without revertOnFinish', () => {
    const { postCallback, setElementState } = setup();

    postCallback({ revertOnFinish: false }, { prevState: { a: 1 } });

    expect(setElementState).not.toHaveBeenCalled();
  });

  // Expand and collapse from the SAME step on the same trigger — the point of the action.
  it('flips a field back and forth on repeated calls', () => {
    const { toggle, getState } = setup();

    toggle({ key: 'visibility' });
    expect(getState()).toEqual({ visibility: true });

    toggle({ key: 'visibility' });
    expect(getState()).toEqual({ visibility: false });

    toggle({ key: 'visibility' });
    expect(getState()).toEqual({ visibility: true });
  });

  it('reads the word the builder writes as the boolean it means', () => {
    const { callback, toggle, getState } = setup();

    callback({ key: 'styleSelectors.open', value: 'true' });
    toggle({ key: 'styleSelectors.open' });

    expect(getState()).toEqual({ styleSelectors: { open: false } });
  });

  it('writes nothing when the toggle names no key', () => {
    const { toggle, setElementState } = setup();

    expect(toggle({}).nextState).toBeUndefined();
    expect(setElementState).not.toHaveBeenCalled();
  });
});
