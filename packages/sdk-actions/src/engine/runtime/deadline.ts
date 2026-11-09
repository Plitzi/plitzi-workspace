import { ActionRunError } from './errors';

/**
 * The run's deadline, as a promise that loses patience.
 *
 * Aborting the controller is the polite half: a task that watches its signal stops, and the loop refuses to start
 * the next step. It is not enough on its own, because a step that ignores the signal — a driver that does not
 * take one, a provider client that swallows it, a `while (true)` inside a task — leaves the run awaiting something
 * that never returns. That is the stuck run this exists to end: nothing else in the process can tell the
 * difference between a flow that is working hard and one that will never finish.
 *
 * Racing the flow against this means the RUN always ends, even when a step does not. What the step does after
 * that is beyond anybody's reach in a single-threaded runtime — but it no longer holds a caller, a slot, or a
 * connection while it does it.
 */
export const createDeadline = (timeoutMs: number, controller: AbortController) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let fail: (error: ActionRunError) => void = () => undefined;
  /** When it runs out: `timeoutMs` from now, later by what the run waited for the platform's capacity. */
  let dueAt = Date.now() + timeoutMs;
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(
      () => {
        controller.abort();
        fail(new ActionRunError('timeout', `Action exceeded its ${timeoutMs}ms budget`, 'time'));
      },
      Math.max(0, dueAt - Date.now())
    );
  };
  const promise = new Promise<never>((_resolve, reject) => {
    fail = reject;
  });
  arm();

  return {
    promise,
    clear: () => clearTimeout(timer),
    /** A wait for a runner — its queue, a turn at its CPU — is the platform's time, not the run's: the limit moves. */
    extend: (ms: number) => {
      dueAt += ms;
      arm();
    }
  };
};
