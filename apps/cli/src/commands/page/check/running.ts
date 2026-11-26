import { readDevTools } from '@plitzi/sdk-authoring';

import type { DevToolsDriver, DevToolsReport } from '@plitzi/sdk-authoring';

/**
 * How long a reading of the state waits for the flows still on their way — a page-load flow waiting out a delay, a
 * demo stepping through its states — before it reads the page as it is, and says which flows still run.
 */
export const RUNNING_WAIT_MS = 3000;
const RUNNING_POLL_MS = 200;

/**
 * The page's dev tools read once the flows running as it settled have ended, or the wait has run out: `state {}` read
 * while a page-load flow waited out a delay was taken for a flow that never ran (a run debugged one that worked).
 */
export const readOnceFlowsEnd = async (
  page: DevToolsDriver & { waitForTimeout: (ms: number) => Promise<void> },
  waitMs: number
): Promise<DevToolsReport> => {
  let read = await readDevTools(page, { state: true });
  for (let waited = 0; read.running.length > 0 && waited < waitMs; waited += RUNNING_POLL_MS) {
    await page.waitForTimeout(RUNNING_POLL_MS);
    read = await readDevTools(page, { state: true });
  }

  return read;
};
