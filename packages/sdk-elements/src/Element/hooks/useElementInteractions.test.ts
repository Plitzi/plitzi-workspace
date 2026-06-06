import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import useElementInteractions from './useElementInteractions';

import type { Element, InteractionCallbackParamValues, InteractionPostCallback } from '@plitzi/sdk-shared';

const definition: Element['definition'] = {
  rootId: 'root',
  label: 'Button',
  type: 'button',
  styleSelectors: { base: 'btn' }
};

// The shared InteractionCallback type returns `unknown`; this hook always returns { prevState, nextState }.
type SetStateResult = { prevState: Record<string, unknown>; nextState: Record<string, unknown> };
type SetStateCallback = (params: InteractionCallbackParamValues) => SetStateResult;

const setup = () => {
  const setElementState = vi.fn(() => true);
  const { result } = renderHook(() =>
    useElementInteractions({ attributes: { text: 'hi' }, definition, setElementState })
  );
  const callback = result.current.setState.callback as SetStateCallback;
  const postCallback = result.current.setState.postCallback as InteractionPostCallback;

  return { callback, postCallback, setElementState };
};

describe('useElementInteractions', () => {
  it('coerces "true"/"false" strings to booleans before setting state', () => {
    const { callback, setElementState } = setup();

    const { nextState } = callback({ key: 'active', value: 'true' });

    expect(nextState).toEqual({ active: true });
    expect(setElementState).toHaveBeenCalledWith({ active: true });
  });

  it('coerces "yes"/"no" strings to booleans', () => {
    const { callback } = setup();

    expect(callback({ key: 'active', value: 'no' }).nextState).toEqual({ active: false });
  });

  it('keeps non-boolean strings as-is and sets nested keys', () => {
    const { callback } = setup();

    expect(callback({ key: 'a.b', value: 'hello' }).nextState).toEqual({ a: { b: 'hello' } });
  });

  it('returns the previous state untouched when key or value is missing', () => {
    const { callback, setElementState } = setup();

    const { prevState, nextState } = callback({ key: 'active' });

    expect(prevState).toEqual({});
    expect(nextState).toEqual({});
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
