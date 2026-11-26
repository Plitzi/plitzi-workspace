import { describe, expect, it } from 'vitest';

import { readOnceFlowsEnd } from './running';

import type { DevToolsReport } from '@plitzi/sdk-authoring';

/** A page whose dev tools answer each read with the next report given, and whose clock is the waits asked of it. */
const pageAnswering = (reports: DevToolsReport[]) => {
  let waited = 0;
  let at = 0;

  return {
    page: {
      evaluate: <R>(): Promise<R> => {
        const report = reports[Math.min(at, reports.length - 1)];
        at += 1;

        // The reader's own function is never run here: the test hands its answer back as the page would.
        return Promise.resolve(report as R);
      },
      waitForTimeout: (ms: number) => {
        waited += ms;

        return Promise.resolve();
      }
    },
    waited: () => waited
  };
};

const report = (running: DevToolsReport['running'], state: unknown): DevToolsReport => ({
  available: true,
  flows: [],
  running,
  serverFailures: {},
  state
});

const LOADING = [{ trigger: 'Step the demo [onPageLoad]', on: 'home', ms: 400 }];

describe('reading the state once the flows end', () => {
  // A page-load flow waiting out a delay: read at once, its state said `{}` — a run debugged a flow that worked.
  it('reads again until the flows on their way have ended', async () => {
    const { page, waited } = pageAnswering([
      report(LOADING, {}),
      report(LOADING, { step: 1 }),
      report([], { step: 2 })
    ]);

    expect((await readOnceFlowsEnd(page, 3000)).state).toEqual({ step: 2 });
    expect(waited()).toBe(400);
  });

  it('stops waiting at its bound, and keeps what still runs to be said', async () => {
    const { page, waited } = pageAnswering([report(LOADING, { step: 1 })]);
    const read = await readOnceFlowsEnd(page, 1000);

    expect(read.running).toEqual(LOADING);
    expect(waited()).toBe(1000);
  });

  it('reads once when nothing asks it to wait', async () => {
    const { page, waited } = pageAnswering([report(LOADING, {})]);

    await readOnceFlowsEnd(page, 0);

    expect(waited()).toBe(0);
  });
});
