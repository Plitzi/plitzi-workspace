import { useSyncExternalStore } from 'react';

/**
 * False while the server's HTML is being hydrated, true from then on.
 *
 * The dev tools remember where they were docked and whether they were open, and they remember it in `localStorage`
 * — which the server cannot see. Reading it during the first client render is what breaks a hydrated page: the
 * markup disagrees with what the server sent, React answers "this won't be patched up", and the page is left with
 * the server's layout classes wrapped around a panel the client placed somewhere else. The visible half of that is
 * a page that will not lay itself out until the next navigation.
 *
 * `useSyncExternalStore` is what makes the answer honest per render pass rather than per environment: React uses
 * the server snapshot while hydrating and the client one everywhere else, so a client-only render — the builder —
 * pays nothing and sees no flash.
 */
const subscribe = () => () => {};

const useHydrated = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );

export default useHydrated;
