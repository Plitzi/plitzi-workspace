import chalk from 'chalk';

import { ownServer, serveCopy } from './acceptance';
import { canLinger, keepServer, keptServer, LINGER_MS } from './lingering';
import { copyOf, runPaths, taskPaths } from './paths';
import { projectOrigin } from '../browser';

import type { PlitziProject } from '../commands/existingProject';

/**
 * Where a page of the project here is served for a check or a picture — and, in a task's copy whose own server is not
 * running, the copy served for that command alone and stopped after it. Agents started their copy's server by hand to
 * look at a page and spent their steps on it: start it in the background, wait, ask its port, stop it after
 * (la-velada: 64 of them across a run, and one `pkill` that stopped every copy's server). A server of the agent's own,
 * running, is used as it is.
 */
export const originHere = async (
  root: string,
  project: PlitziProject | undefined,
  url?: string
): Promise<{ origin: string; stop?: () => void } | { problem: string }> => {
  const copy = url === undefined ? copyOf(root) : undefined;
  if (!copy) {
    return projectOrigin(root, project, url);
  }

  // In a copy, only its own server is it — named by the mark of the folder its /health answers with: a port guessed
  // may be another copy's, or another project's of the person's.
  const own = await ownServer(root);
  if (own !== undefined) {
    return { origin: `http://127.0.0.1:${String(own)}` };
  }

  const cache = taskPaths(runPaths(copy.root, copy.run), copy.task).cache;
  const kept = await keptServer(root, cache);
  if (kept !== undefined) {
    return { origin: kept };
  }

  const served = await serveCopy(root, copy.root, cache, { again: 'run it again' });
  if ('problem' in served) {
    return { problem: `Nothing of the copy's own answers, and serving it for this command failed: ${served.problem}` };
  }

  // Kept for the next picture, where processes are a group to stop later; stopped after this command elsewhere.
  const pid = canLinger() ? served.keep() : undefined;
  if (pid !== undefined) {
    await keepServer(root, cache, pid, served.port);
  }

  // Said where it does not get in the way of an answer read as JSON.
  process.stderr.write(
    chalk.dim(
      pid === undefined
        ? `· no server of the copy's answered: served on :${String(served.port)} for this command, stopped after it\n`
        : `· no server of the copy's answered: served on :${String(served.port)}, kept ${String(LINGER_MS / 60_000)} min for the next command\n`
    )
  );

  return pid === undefined ? { origin: served.url, stop: served.stop } : { origin: served.url };
};
