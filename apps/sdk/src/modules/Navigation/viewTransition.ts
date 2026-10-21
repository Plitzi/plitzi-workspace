/** The longest a view transition holds the old page for the new one to be drawn: past it, it ends on what is there. */
export const VIEW_TRANSITION_WAIT_MS = 1000;

/** What a view transition needs of the page: `document` and `window` in a browser, stand-ins in a test. */
export interface TransitionHost {
  startViewTransition?: (update: () => Promise<void>) => unknown;
  prefersReducedMotion: () => boolean;
}

export const browserHost = (): TransitionHost | undefined =>
  typeof document === 'undefined'
    ? undefined
    : {
        ...(typeof document.startViewTransition === 'function'
          ? { startViewTransition: (update: () => Promise<void>) => document.startViewTransition(update) }
          : {}),
        prefersReducedMotion: () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
      };

/**
 * A move between pages, drawn as one view becoming the next when the space asks for it (`settings.viewTransitions`),
 * the browser can and the visitor wants motion; otherwise made at once. The router renders the new page in a transition
 * of React's, after the browser's callback has returned — so the callback waits for `drawn` to be called (when the new
 * location is laid out), and never longer than `waitMs`.
 */
export const moveDrawn = (
  go: () => void,
  {
    asked,
    host,
    drawn,
    waitMs = VIEW_TRANSITION_WAIT_MS
  }: {
    asked: unknown;
    host: TransitionHost | undefined;
    drawn: { current: (() => void) | undefined };
    waitMs?: number;
  }
): void => {
  if (asked !== true || !host?.startViewTransition || host.prefersReducedMotion()) {
    go();

    return;
  }

  host.startViewTransition(
    () =>
      new Promise<void>(resolve => {
        drawn.current = resolve;
        go();
        setTimeout(resolve, waitMs);
      })
  );
};
