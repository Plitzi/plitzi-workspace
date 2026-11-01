import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import useBlurValidation from './useBlurValidation';

const press = (type: 'pointerdown' | 'pointerup') => document.dispatchEvent(new Event(type, { bubbles: true }));

// A field checked as it loses focus moved what was below it between a press and its release: the click missed.
describe('a field checked as it loses focus', () => {
  it('is checked at once when the keyboard took the focus, and after the press lands when a press did', async () => {
    vi.useFakeTimers();
    const validate = vi.fn();
    const { result } = renderHook(() => useBlurValidation(validate));

    result.current();
    expect(validate).toHaveBeenCalledTimes(1);

    press('pointerdown');
    result.current();
    expect(validate).toHaveBeenCalledTimes(1);
    press('pointerup');
    expect(validate).toHaveBeenCalledTimes(1);
    await vi.runAllTimersAsync();
    expect(validate).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
