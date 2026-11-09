/**
 * Subscribes to a signal, and covers the case every hand-rolled subscription misses: one that is ALREADY aborted.
 *
 * `addEventListener('abort', …)` on a signal that has already fired never calls back — the event is long gone — so
 * a listener attached after any `await` is a cancellation silently dropped. That window is not theoretical: an
 * action is READ before its run begins, and a page that gave up during that read left the run to carry on holding
 * a slot and a connection for nobody.
 *
 * Returns the unsubscribe, so a caller that outlives the signal does not leak a listener onto it.
 */
export const onAbort = (signal: AbortSignal | undefined, stop: () => void): (() => void) => {
  if (!signal) {
    return () => {};
  }

  if (signal.aborted) {
    stop();

    return () => {};
  }

  signal.addEventListener('abort', stop, { once: true });

  return () => signal.removeEventListener('abort', stop);
};

export default onAbort;
