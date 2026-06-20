import { useEffect, useState } from 'react';

const TTL = 60 * 60 * 1000;

type Cached = {
  value: number;
  at: number;
};

const readCache = (key: string): number | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Cached;
    if (Date.now() - parsed.at > TTL) {
      return null;
    }

    return parsed.value;
  } catch {
    return null;
  }
};

const writeCache = (key: string, value: number) => {
  try {
    localStorage.setItem(key, JSON.stringify({ value, at: Date.now() } satisfies Cached));
  } catch {
    // Ignore quota / privacy-mode failures — the badge just refetches next visit.
  }
};

// Fetches a single number from a public JSON endpoint, caching it in localStorage for an hour so repeat visits don't
// hammer the API (GitHub's unauthenticated limit is 60 req/h). `extract` pulls the number out of the parsed payload;
// returning null on any failure lets the badge render a graceful fallback instead of a broken count.
const useLiveStat = (cacheKey: string, url: string, extract: (data: unknown) => number | undefined) => {
  const [value, setValue] = useState<number | null>(() => readCache(cacheKey));

  useEffect(() => {
    if (value !== null) {
      return;
    }

    let active = true;
    fetch(url)
      .then(res => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: unknown) => {
        const next = extract(data);
        if (active && typeof next === 'number') {
          setValue(next);
          writeCache(cacheKey, next);
        }
      })
      .catch(() => {
        // Network/rate-limit failure: leave value null so the badge shows its fallback.
      });

    return () => {
      active = false;
    };
  }, [cacheKey, url, extract, value]);

  return value;
};

export default useLiveStat;
