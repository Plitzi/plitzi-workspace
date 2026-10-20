import { readFileSync } from 'node:fs';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';
import { ACTIVE_RUN_FILE } from '@plitzi/sdk-shared/project';
import { RUN_STATUS_PATH } from '@plitzi/sdk-shared/runs';

import type { Stage } from '../../core/http/types';

/** How often the project is looked at for a run opening or ending: a stat, cheap enough to do while developing. */
const EVERY_MS = 5000;

/** The open run's name, as `plitzi run open` wrote it — none open, or a file that does not say one, undefined. */
const openRun = (root: string): string | undefined => {
  try {
    const claim: unknown = JSON.parse(readFileSync(path.join(root, ACTIVE_RUN_FILE), 'utf-8'));

    return isRecord(claim) && typeof claim.runId === 'string' ? claim.runId : undefined;
  } catch {
    return undefined;
  }
};

/**
 * A run of agents (`plitzi run`) open in the project, said on this server's console while developing: this server
 * serves the project as it is, and a run writes nothing into it until its finish — so a person looking here for the
 * agents' work is told where it is (`npm run start:preview`). Said when the server starts with one open, when one opens,
 * and when it ends. Answers what stops looking.
 */
export const watchAgentRuns = (
  root: string,
  { say = console.log, everyMs = EVERY_MS }: { say?: (line: string) => void; everyMs?: number } = {}
): (() => void) => {
  let told: string | undefined;
  const look = (): void => {
    const runId = openRun(root);
    if (runId !== undefined && runId !== told) {
      say(
        `[runs] agents are working run "${runId}": this server serves the project as it is, and their approved work reaches it at the run's finish — to watch it as they go: npm run start:preview`
      );
    } else if (runId === undefined && told !== undefined) {
      say(`[runs] run "${told}" is closed: what it wrote, if it was finished, is in the project now`);
    }

    told = runId;
  };
  look();
  const timer = setInterval(look, everyMs);
  timer.unref();

  return () => clearInterval(timer);
};

/**
 * The run a preview serves, answered at `RUN_STATUS_PATH` for the page's dev tools (their Run tab): the snapshot `plitzi
 * run preview` keeps in `file` and names in `RUN_STATUS_ENV`. Read on each request — the CLI rewrites it as the run goes —
 * and answered as it is: none yet (the preview just started) is a 404 that says so. Only on a preview's server.
 */
export const runStatusStage =
  (file: string): Stage =>
  ctx => {
    if (ctx.req.path !== RUN_STATUS_PATH) {
      return Promise.resolve(false);
    }

    let text: string | undefined;
    try {
      text = readFileSync(file, 'utf-8');
    } catch {
      text = undefined;
    }

    ctx.res.setHeader('Cache-Control', 'no-store');
    ctx.res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (text === undefined) {
      ctx.res.setStatus(404);
      ctx.res.send(JSON.stringify({ error: 'The run has no snapshot yet: its preview writes one as it starts' }));
    } else {
      ctx.res.send(text);
    }

    return Promise.resolve(true);
  };
