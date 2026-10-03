import { useEffect } from 'react';

/** How long a fragment waits for its element: a section behind a provider appears once its data does. */
export const HASH_WAIT_MS = 3000;

/** What tells that somebody has started moving on their own — past that, landing them somewhere would be a jolt. */
const OWN_SCROLL_EVENTS = ['wheel', 'touchmove', 'keydown', 'pointerdown'] as const;

/** The id a fragment names: `#caf%C3%A9` is `café`, and one that does not decode is taken as written. */
const idOf = (hash: string): string => {
  const raw = hash.replace(/^#/, '');
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

/** The element a fragment names, scrolled to — `scroll-padding-top` and `scroll-behavior` are the document's to say. */
const scrollToAnchor = (id: string): boolean => {
  const element = document.getElementById(id);
  element?.scrollIntoView({ block: 'start' });

  return element !== null;
};

/**
 * Lands on the element a URL's `#fragment` names, after each navigation that carries one — on arrival too.
 *
 * The browser does this by itself only for a page it loaded whole, and only for what is in it at that moment: a
 * client-side navigation never asks it to, and a section that renders once its data arrives is not there yet. So the
 * element is looked for now and, if absent, as the page fills in, for {@link HASH_WAIT_MS}; somebody who scrolls in the
 * meantime has gone somewhere else, and is left there. `navigationKey` makes a second click on the same link land again.
 */
const useScrollToHash = ({
  hash,
  navigationKey,
  enabled
}: {
  hash: string;
  navigationKey?: string;
  enabled: boolean;
}): void => {
  useEffect(() => {
    const id = idOf(hash);
    if (!enabled || !id || typeof document === 'undefined' || scrollToAnchor(id)) {
      return undefined;
    }

    // One abort ends the wait however it ends: found, timed out, the person moved, or the page went away.
    const controller = new AbortController();
    const observer = new MutationObserver(() => {
      if (scrollToAnchor(id)) {
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
  }, [hash, navigationKey, enabled]);
};

export default useScrollToHash;
