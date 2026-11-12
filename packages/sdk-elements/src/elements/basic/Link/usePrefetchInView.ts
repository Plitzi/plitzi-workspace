import { useEffect } from 'react';

import type { RefObject } from 'react';

/**
 * A link on screen gets what following it will need before it is followed (`navigation.prefetch`): when a space is sent
 * in parts, its page's part. When the browser is idle, so a page full of links costs nothing while it draws; asking twice
 * costs nothing either — what is held is not fetched again.
 *
 * One observer for every link of the page: a footer holds dozens, and an observer each was dozens of them.
 */
type Watched = { url: string; prefetch: (url: string) => void };

const watched = new WeakMap<Element, Watched>();
let observer: IntersectionObserver | undefined;

const whenIdle = (task: () => void): void => {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(task, { timeout: 2000 });
  } else {
    setTimeout(task, 200);
  }
};

const observerOf = (): IntersectionObserver => {
  observer ??= new IntersectionObserver(entries => {
    for (const entry of entries) {
      const link = watched.get(entry.target);
      if (!entry.isIntersecting || !link) {
        continue;
      }

      observer?.unobserve(entry.target);
      watched.delete(entry.target);
      whenIdle(() => link.prefetch(link.url));
    }
  });

  return observer;
};

const usePrefetchInView = (
  ref: RefObject<HTMLElement | null> | undefined,
  url: string,
  prefetch: ((url: string) => void) | undefined,
  enabled: boolean
): void => {
  useEffect(() => {
    const node = ref?.current;
    if (!enabled || !prefetch || !node || typeof IntersectionObserver === 'undefined') {
      return;
    }

    watched.set(node, { url, prefetch });
    const watching = observerOf();
    watching.observe(node);

    return () => {
      watching.unobserve(node);
      watched.delete(node);
    };
  }, [ref, url, prefetch, enabled]);
};

export default usePrefetchInView;
