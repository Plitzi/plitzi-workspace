import { use, useCallback, useEffect, useState } from 'react';

import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';

import type { FontStyle } from '@plitzi/sdk-shared';

export type FontCatalogEntry = {
  family: string;
  category: string;
  weights: number[];
  styles: FontStyle[];
  subsets: string[];
};

/** Long enough that typing a family name is one request rather than eight. */
const DEBOUNCE_MS = 250;

/**
 * The Google catalog, through this deployment's own endpoint.
 *
 * `unavailable` is a state of its own, not an empty result: a server with no API key cannot ask Google what exists,
 * and telling somebody "no fonts matched" when nothing was searched would send them looking for a typo.
 */
const useFontCatalog = (query: string, enabled: boolean) => {
  const { server, userKey } = use(NetworkContext);
  const [fonts, setFonts] = useState<FontCatalogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<string>();

  const load = useCallback(
    async (signal: AbortSignal, search: string) => {
      setLoading(true);
      setError(undefined);

      try {
        const response = await fetch(`${server.apiServer}/fonts/catalog?q=${encodeURIComponent(search)}`, {
          signal,
          credentials: 'include',
          headers: { 'plitzi-access-token': userKey }
        });

        if (response.status === 503) {
          setUnavailable(true);
          setFonts([]);

          return;
        }

        if (!response.ok) {
          setError(`The server answered ${response.status}.`);

          return;
        }

        const body = (await response.json()) as { fonts: FontCatalogEntry[] };
        setUnavailable(false);
        setFonts(body.fonts);
      } catch (err) {
        // An abort is the next keystroke, not a failure.
        if (!signal.aborted) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    },
    [server.apiServer, userKey]
  );

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => void load(controller.signal, query), DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [enabled, query, load]);

  return { fonts, loading, unavailable, error };
};

export default useFontCatalog;
