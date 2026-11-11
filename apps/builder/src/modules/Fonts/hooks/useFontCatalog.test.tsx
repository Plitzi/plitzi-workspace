import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import useFontCatalog from './useFontCatalog';
import { fontsBaseUrl } from '../fontsBaseUrl';

vi.mock('@pmodules/Network/hooks/useBuilderNetwork', () => ({
  default: () => ({ server: { apiServer: 'https://api.test' }, userKey: 'k' })
}));

const GEIST = { family: 'Geist', category: 'sans-serif', weights: [400, 700], styles: ['normal'], subsets: ['latin'] };

const answering = (status: number, body: unknown = {}) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(body), { status }));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the font catalog, through the deployment’s endpoint', () => {
  it('asks once, for what was typed last: each keystroke drops the request before it', async () => {
    const fetched = answering(200, { fonts: [GEIST] });
    const { result, rerender } = renderHook(({ query }) => useFontCatalog(query, true), {
      initialProps: { query: 'G' }
    });
    rerender({ query: 'Ge' });
    rerender({ query: 'Geist' });

    await waitFor(() => expect(result.current.fonts).toEqual([GEIST]));
    expect(fetched).toHaveBeenCalledTimes(1);
    expect(fetched).toHaveBeenCalledWith('https://api.test/fonts/catalog?q=Geist', expect.anything());
    expect(result.current).toMatchObject({ loading: false, unavailable: false, error: undefined });
  });

  // A server with no key cannot ask Google what exists: "no fonts matched" would send somebody looking for a typo.
  it('says the catalog is unavailable, apart from finding nothing', async () => {
    answering(503);
    const { result } = renderHook(() => useFontCatalog('Geist', true));

    await waitFor(() => expect(result.current.unavailable).toBe(true));
    expect(result.current.fonts).toEqual([]);
  });

  it('says what the server answered when it failed, and stops loading', async () => {
    answering(500);
    const { result } = renderHook(() => useFontCatalog('Geist', true));

    await waitFor(() => expect(result.current.error).toBe('The server answered 500.'));
    expect(result.current.loading).toBe(false);
  });

  it('asks nothing while it is not open', async () => {
    const fetched = answering(200, { fonts: [GEIST] });
    renderHook(() => useFontCatalog('Geist', false));
    await new Promise(resolve => setTimeout(resolve, 400));

    expect(fetched).not.toHaveBeenCalled();
  });
});

describe('where an uploaded face is addressed from', () => {
  it('is what the deployment declared, or the page server’s own /fonts', () => {
    expect(fontsBaseUrl({ fontsBaseUrl: 'https://cdn.test/fonts', ssrServer: 'https://ssr.test' })).toBe(
      'https://cdn.test/fonts'
    );
    expect(fontsBaseUrl({ fontsBaseUrl: '', ssrServer: 'https://ssr.test' })).toBe('https://ssr.test/fonts');
    expect(fontsBaseUrl({ fontsBaseUrl: '', ssrServer: '' })).toBeUndefined();
  });
});
