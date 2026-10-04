import { MOTION_SEEN_ATTRIBUTE, MOTION_VIEW_SELECTOR } from './motion';

const WAITING = `${MOTION_VIEW_SELECTOR}:not([${MOTION_SEEN_ATTRIBUTE}])`;

/**
 * Plays every arrival under `root` that waits to be seen (`motion: { on: 'view' }`) the first time it comes into view,
 * and never again: the stylesheet holds it at its start until the element carries `data-motion-seen`, which this sets
 * and nothing takes off. Elements added later — a page navigated to, a list's new rows — are watched as they arrive.
 * Answers the function that stops watching.
 *
 * One observer for the whole tree rather than one per element: a page of cards is hundreds of them. A browser without
 * `IntersectionObserver` shows each arrival at once, as one that cannot know what is on screen.
 */
export const revealOnView = (root: Element): (() => void) => {
  const reveal = (element: Element): void => element.setAttribute(MOTION_SEEN_ATTRIBUTE, '');
  const waitingIn = (node: Element): Element[] => [
    ...(node.matches(WAITING) ? [node] : []),
    ...Array.from(node.querySelectorAll(WAITING))
  ];

  // Read as a value the platform may lack: the DOM's types declare it always there.
  const observable: unknown = Reflect.get(globalThis, 'IntersectionObserver');
  if (typeof observable !== 'function') {
    waitingIn(root).forEach(reveal);

    return () => undefined;
  }

  const seen = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        reveal(entry.target);
        seen.unobserve(entry.target);
      }
    }
  });
  const watch = (node: Element): void => waitingIn(node).forEach(element => seen.observe(element));
  const added = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'attributes' && record.target instanceof Element) {
        watch(record.target);
      }

      record.addedNodes.forEach(node => {
        if (node instanceof Element) {
          watch(node);
        }
      });
    }
  });

  watch(root);
  // `attributes` too: an element whose motion changes to `view` — edited on the builder's canvas — is not a new node.
  added.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-motion-on'] });

  return () => {
    seen.disconnect();
    added.disconnect();
  };
};
