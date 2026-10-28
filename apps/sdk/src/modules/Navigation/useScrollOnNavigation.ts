import { useEffect, useRef } from 'react';

import { HASH_WAIT_MS, OWN_SCROLL_EVENTS } from './useScrollToHash';

/** How the router came to a location: a link or a step (`PUSH`, `REPLACE`), or the browser's back and forward (`POP`). */
export type NavigationAction = 'POP' | 'PUSH' | 'REPLACE';

/** Where the visitor left each location, by the router's key for it: what back and forward return to. */
const leftAt = new Map<string, number>();

/** The furthest the document scrolls now. */
const furthest = (): number => document.documentElement.scrollHeight - window.innerHeight;

/**
 * The document's scroll as a navigation inside the site leaves it — what the browser does for a page it loads, and a
 * client-side navigation never asks it to: a room closed with `navigate('/')` opened Home at its foot, and Explore
 * reached from a scrolled room opened past its title.
 *
 * Another page opens at its top; back and forward return to where the visitor left that page — waited for while the
 * page fills in, as a fragment's element is, and given up the moment they move on their own. A fragment is
 * `useScrollToHash`'s, and a change of the query alone — a filter, a sheet opened by `?stats=1` — moves nothing.
 */
const useScrollOnNavigation = ({
  pathname,
  hash,
  navigationKey,
  action,
  enabled
}: {
  pathname: string;
  hash: string;
  navigationKey?: string;
  action?: NavigationAction;
  enabled: boolean;
}): void => {
  const at = useRef<{ pathname: string; key?: string } | undefined>(undefined);

  // The browser's own return would land before the page it returns to is drawn: the site says where instead.
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      return undefined;
    }

    const before = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    const keep = (): void => {
      const key = at.current?.key;
      if (key !== undefined) {
        leftAt.set(key, window.scrollY);
      }
    };
    window.addEventListener('scroll', keep, { passive: true });

    return () => {
      window.removeEventListener('scroll', keep);
      window.history.scrollRestoration = before;
    };
  }, [enabled]);

  useEffect(() => {
    const previous = at.current;
    at.current = { pathname, ...(navigationKey === undefined ? {} : { key: navigationKey }) };
    // The page as it loaded is the browser's; the same page with another query is where the visitor is.
    if (!enabled || !previous || hash !== '' || previous.pathname === pathname) {
      return undefined;
    }

    const target = action === 'POP' && navigationKey !== undefined ? (leftAt.get(navigationKey) ?? 0) : 0;
    window.scrollTo(0, target);
    if (target <= furthest()) {
      return undefined;
    }

    // Returned to further down than the page reaches yet: landed there as it fills in, unless the visitor moves first.
    const controller = new AbortController();
    const observer = new MutationObserver(() => {
      if (target <= furthest()) {
        window.scrollTo(0, target);
        controller.abort();
      }
    });
    const timer = setTimeout(() => controller.abort(), HASH_WAIT_MS);
    controller.signal.addEventListener('abort', () => {
      observer.disconnect();
      clearTimeout(timer);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    OWN_SCROLL_EVENTS.forEach(event =>
      window.addEventListener(event, () => controller.abort(), { once: true, passive: true, signal: controller.signal })
    );

    return () => controller.abort();
  }, [pathname, hash, navigationKey, action, enabled]);
};

export default useScrollOnNavigation;
