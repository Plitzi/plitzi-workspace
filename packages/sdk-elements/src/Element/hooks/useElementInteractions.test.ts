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

  return { callback, postCallback, setElementState, getState: () => state };
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
});
