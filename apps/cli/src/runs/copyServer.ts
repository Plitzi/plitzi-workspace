import fs from 'node:fs/promises';
import path from 'node:path';

import chalk from 'chalk';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { ownServer, serveCopy } from './acceptance';
import { canLinger, keepServer, keptPort, keptServer, LINGER_MS, newestWrite, previewedServer } from './lingering';
import { copyOf, runPaths, taskPaths } from './paths';
import { projectOrigin, readHealth } from '../browser';
import { DEV_SERVER_FILE } from '../scaffold/paths';

import type { PlitziProject } from '../commands/existingProject';

/**
 * Where a page of the project here is served for a check or a picture — and, in a task's copy whose own server is not
 * running, the copy served for that command alone and stopped after it. Agents started their copy's server by hand to
 * look at a page and spent their steps on it: start it in the background, wait, ask its port, stop it after
 * (64 of them across a run, and one `pkill` that stopped every copy's server). A server of the agent's own,
 * running, is used as it is.
 */
export const originHere = async (
  root: string,
  project: PlitziProject | undefined,
  url?: string
): Promise<{ origin: string; stop?: () => void } | { problem: string }> => {
  const found = await servedHere(root, project, url);
  if (!('problem' in found)) {
    sayStale(await readHealth(found.origin));
  }

  return found;
};

/**
 * A save to the space that did not author, as the server's `/health` says it: what is read is the space as it last
 * authored — a run's designer measured an element the refused save added and was told it was "not drawn there".
 */
export const sayStale = (health: unknown): void => {
  const why = isRecord(health) && typeof health.spaceStale === 'string' ? health.spaceStale : undefined;
  const first = why
    ?.split('\n')
    .map(line => line.trim())
    .find(line => line !== '');
  if (first !== undefined) {
    process.stderr.write(
      chalk.yellow(
        `· the last save to the space did not author: this is the space as it last authored, without that save — ${first} (npm run author says it whole)\n`
      )
    );
  }
};

const servedHere = async (
  root: string,
  project: PlitziProject | undefined,
  url?: string
): Promise<{ origin: string; stop?: () => void } | { problem: string }> => {
  const copy = url === undefined ? copyOf(root) : undefined;
  if (!copy) {
    return projectOrigin(root, project, url);
  }

  const cache = taskPaths(runPaths(copy.root, copy.run), copy.task).cache;
  // In a copy, only its own server is it — named by the mark of the folder its /health answers with: a port guessed
  // may be another copy's, or another project's of the person's. The server the CLI kept writes the same record as
  // the agent's own would: it is the CLI's, served again once the copy changed — never reused as it was (four
  // of five agents measured code they had changed, told "your own server", and stopped it by hand).
  const own = await ownServer(root);
  if (own !== undefined && own !== (await keptPort(cache))) {
    // The agent's own server, left as it is — it holds the copy's state — but written to since it started, said: it
    // serves the copy as it was unless it watches (a run's dev-1 measured a gap of 12px it had changed).
    const started = await fs
      .stat(path.join(root, DEV_SERVER_FILE))
      .then(stat => stat.mtimeMs)
      .catch(() => Date.now());
    if ((await newestWrite(root)) > started) {
      process.stderr.write(
        chalk.yellow(
          `· served by your own server on :${String(own)}, and the copy's src/ was written since it started: it shows the copy as it was unless it watches — restart it, or stop it (plitzi server stop --port ${String(own)}, in the copy) and the CLI serves the copy as it is\n`
        )
      );
    }

    return { origin: `http://127.0.0.1:${String(own)}` };
  }

  // A look or a preview serving the copy: it is the copy's server while it runs — a second beside it fights it.
  // Said each time, not only the first: dev-1 found the port of the server holding the copy's state in an error.
  const previewed = await previewedServer(root, cache);
  if (previewed !== undefined) {
    process.stderr.write(chalk.dim(`· served by the look or preview serving the copy: ${previewed}\n`));

    return { origin: previewed };
  }

  const kept = await keptServer(root, cache);
  if (kept !== undefined) {
    process.stderr.write(chalk.dim(`· served by the CLI's server of the copy, kept from a command before: ${kept}\n`));

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
        ? `· the copy served on :${String(served.port)} for this command, stopped after it (none was running)\n`
        : `· the copy served on :${String(served.port)}, kept ${String(LINGER_MS / 60_000)} min for the next command (none was running)\n`
    )
  );

  return pid === undefined ? { origin: served.url, stop: served.stop } : { origin: served.url };
};
