/**
 * The flows running now on this page, as the dev tools say them (`window.__plitzi.running()`).
 *
 * A finished flow is logged with its steps; one still running — a page-load flow waiting out a `delay`, a demo stepping
 * through its states — was nowhere, so a reading of the page's state taken meanwhile said `{}` with nothing to tell it
 * from a flow that never ran. Each flow is held from its first step to its last, whatever its `whileRunning`.
 */

/** A flow on its way: what fired it, on what, and since when (ms on the page's clock). */
export type RunningFlow = { trigger: string; on?: string; since: number };

const running = new Map<number, RunningFlow>();
let next = 0;

/** Holds a flow as running until the function it answers is called — once, whatever happens to the flow. */
export const flowStarted = (flow: RunningFlow): (() => void) => {
  next += 1;
  const id = next;
  running.set(id, flow);

  return () => {
    running.delete(id);
  };
};

/** The flows running now, the oldest first. */
export const flowsRunning = (): RunningFlow[] => [...running.values()];
