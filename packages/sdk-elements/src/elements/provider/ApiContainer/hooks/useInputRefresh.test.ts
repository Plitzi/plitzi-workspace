import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import useInputRefresh from './useInputRefresh';

import type { UseInputRefreshProps } from './useInputRefresh';

const setup = (initial: Partial<UseInputRefreshProps>) => {
  const performQuery = vi.fn(() => Promise.resolve());
  const hook = renderHook(
    (props: Partial<UseInputRefreshProps>) =>
      useInputRefresh({ enabled: true, input: undefined, savedInput: undefined, performQuery, ...props }),
    { initialProps: initial }
  );

  return { performQuery, ...hook };
};

describe('useInputRefresh', () => {
  it('asks nothing while the input says what the page was resolved with', () => {
    const { performQuery, rerender } = setup({ input: { country: 'es' }, savedInput: { country: 'es' } });
    rerender({ input: { country: 'es' }, savedInput: { country: 'es' } });

    expect(performQuery).not.toHaveBeenCalled();
  });

  it('asks again with the new input whenever a bound value changes — an empty one included', () => {
    const { performQuery, rerender } = setup({ input: { country: '' }, savedInput: { country: '' } });

    rerender({ input: { country: 'fr' }, savedInput: { country: '' } });
    expect(performQuery).toHaveBeenLastCalledWith({ input: { country: 'fr' } });

    rerender({ input: { country: '' }, savedInput: { country: '' } });
    expect(performQuery).toHaveBeenLastCalledWith({ input: { country: '' } });
    expect(performQuery).toHaveBeenCalledTimes(2);
  });

  it('asks at once when the binding already disagrees with what was saved', () => {
    const { performQuery } = setup({ input: { country: 'pt' }, savedInput: {} });

    expect(performQuery).toHaveBeenCalledWith({ input: { country: 'pt' } });
  });

  it('waits for a payload to ask about', () => {
    const { performQuery, rerender } = setup({ enabled: false, input: { q: 'a' }, savedInput: {} });
    expect(performQuery).not.toHaveBeenCalled();

    rerender({ enabled: true, input: { q: 'a' }, savedInput: {} });
    expect(performQuery).toHaveBeenCalledTimes(1);
  });
});
