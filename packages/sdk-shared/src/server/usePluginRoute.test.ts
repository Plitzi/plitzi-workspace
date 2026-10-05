import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import usePluginRoute from './usePluginRoute';
import { useCommonStore } from '../store';

vi.mock('../store', () => ({ useCommonStore: vi.fn() }));

const servedWith = (endpoint: string | undefined) => {
  vi.mocked(useCommonStore).mockReturnValue([endpoint] as unknown as ReturnType<typeof useCommonStore>);
};

describe('usePluginRoute', () => {
  it('names the plugin’s route on the server this page came from', () => {
    servedWith('/_action');
    const { result } = renderHook(() => usePluginRoute('board'));

    expect(result.current('/layout')).toBe(`${window.location.origin}/fn/plugins/board/layout`);
    expect(result.current('layouts/42')).toBe(`${window.location.origin}/fn/plugins/board/layouts/42`);
  });

  it('follows a server on another origin, as an embedded page has it', () => {
    servedWith('https://space.example/_action');
    const { result } = renderHook(() => usePluginRoute('board'));

    expect(result.current('/layout')).toBe('https://space.example/fn/plugins/board/layout');
  });

  it('is nothing on a page served without a server that runs code', () => {
    servedWith(undefined);
    const { result } = renderHook(() => usePluginRoute('board'));

    expect(result.current('/layout')).toBeUndefined();
  });
});
