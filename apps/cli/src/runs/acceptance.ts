import { spawn } from 'node:child_process';
import { realpathSync } from 'node:fs';
import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';
import { projectMark } from '@plitzi/sdk-shared/project';

import { inTurns } from './inTurns';
import { stopKept } from './lingering';
import { listenersUnder, stopListener, stopTree, TREE } from './processes';
import { UNANSWERED_EXIT } from '../commands/terminal';
import { runScript, scriptsOf, tail } from '../commands/verify';
import { localFetch } from '../http';
import { DEV_SERVER_FILE, PROJECT_TMP, SERVER_RECORD_ENV } from '../scaffold/paths';

import type { Acceptance, AcceptanceResult } from './model';

/**
 * A task's acceptance, checked by the commands its plan gives: each run in the task's copy as `complete` runs
 * the project's checks, passing on exit 0 — so what is asked is held by the CLI, not only read by the lead at review.
 * `plitzi` in a check is this CLI, the one the run is worked with; `$PLITZI_URL`, the copy served by its own start
 * script on a free port, for as long as the checks take.
 */

const isChecked = (each: Acceptance): each is { said: string; check: string } => typeof each !== 'string';

/** `port` when nothing listens on it, else any free one: a preview keeps the address a person knows when it can. */
export const portOr = (port: number): Promise<number> =>
  new Promise(resolve => {
    const server = net.createServer();
    server.once('error', () => resolve(freePort()));
    server.listen(port, '127.0.0.1', () => server.close(() => resolve(port)));
  });

export const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === 'object') {
          resolve(address.port);
        } else {
          reject(new Error('no free port for the copy to be served on'));
        }
      });
    });
  });

/** Until something answers on `url`, or `ms` pass — asked once at least: whether it did. */
export const answering = async (url: string, ms: number): Promise<boolean> => {
  const until = Date.now() + ms;
  for (;;) {
    const ok = await localFetch(url).then(
      () => true,
      () => false
    );
    if (ok) {
      return true;
    }

    if (Date.now() >= until) {
      return false;
    }

    await new Promise(resolve => setTimeout(resolve, 300));
  }
};

/**
 * Whether a check needs the copy served: it names `$PLITZI_URL` or `$PLITZI_PORT`, or it runs the project's Playwright
 * specs — configured by `PORT`, which a served check is given.
 */
export const namesServedCopy = (check: string): boolean =>
  /PLITZI_(?:URL|PORT)\b/.test(check) || /\bplaywright\s+test\b/.test(check);

/**
 * The check as any shell runs it: `$PLITZI_URL` and `$PLITZI_PORT` (or `${…}`) written in as their values — a POSIX
 * shell would expand them, Windows' `cmd.exe` would not.
 */
export const withServedValues = (check: string, values: Readonly<Record<string, string>>): string =>
  check.replace(/\$\{?(PLITZI_(?:URL|PORT))\}?/g, (written, name: string) =>
    Object.hasOwn(values, name) ? values[name] : written
  );

/**
 * Where the copy's server answers, within `ms`: the port it says it took, in the record it writes once it listens — or the
 * port asked, once that answers (a server that writes no record). None when neither does.
 */
const answeringWhere = async (record: string, asked: number, ms: number): Promise<number | undefined> => {
  for (const until = Date.now() + ms; Date.now() < until;) {
    const value: unknown = await fs
      .readFile(record, 'utf-8')
      .then(text => JSON.parse(text) as unknown)
      .catch(() => undefined);
    const said = isRecord(value) && typeof value.port === 'number' ? value.port : undefined;
    if (said !== undefined && (await answering(`http://127.0.0.1:${String(said)}`, Math.max(0, until - Date.now())))) {
      return said;
    }

    if (said === undefined && (await answering(`http://127.0.0.1:${String(asked)}`, 0))) {
      return asked;
    }

    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return undefined;
};

/**
 * A server the agent started in its copy and left running: it holds the copy's state (its locks, its files) as the one
 * `complete` starts would — said before starting that one, with its port, rather than met as a lock the two fight over.
 */
export const ownServer = async (work: string): Promise<number | undefined> => {
  const value: unknown = await fs
    .readFile(path.join(work, DEV_SERVER_FILE), 'utf-8')
    .then(text => JSON.parse(text) as unknown)
    .catch(() => undefined);
  const port = isRecord(value) && typeof value.port === 'number' ? value.port : undefined;
  if (port === undefined) {
    return undefined;
  }

  // The copy's own, by the mark of its folder its `/health` answers with: a record left behind by a server that died
  // names a port another copy's server may hold now, and that one is no server of this copy's.
  const health: unknown = await localFetch(`http://127.0.0.1:${String(port)}/health`, {
    signal: AbortSignal.timeout(1_000)
  })
    .then(async (response): Promise<unknown> => response.json())
    .catch(() => undefined);
  if (!isRecord(health)) {
    return undefined;
  }

  return typeof health.Instance !== 'string' || health.Instance === projectMark(work) ? port : undefined;
};

/** Waits, a few seconds at most, until nothing answers on `port`. */
const stoppedAnswering = async (port: number): Promise<void> => {
  for (let tries = 0; tries < 20; tries += 1) {
    const answers = await localFetch(`http://127.0.0.1:${String(port)}/health`, { signal: AbortSignal.timeout(500) })
      .then(() => true)
      .catch(() => false);
    if (!answers) {
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 250));
  }
};

/** The copy served by its own start script on a free port, quietly: what `$PLITZI_URL` names. */
export const serveCopy = async (
  work: string,
  root: string,
  cache: string,
  /** What the agent does once it has put right what kept the copy from being served: `complete` by default. */
  { again = 'complete again' }: { again?: string } = {}
): Promise<{ url: string; port: number; stop: () => void; keep: () => number | undefined } | { problem: string }> => {
  // Kept from a picture before: stopped — the copy is served here for this command, one server at a time on it.
  await stopKept(cache);
  // One of the agent's own in the copy (npm start) holds its state too: stopped here, said — a run's agents stopped
  // theirs by hand before every check (21 times), refused until they did. It is the copy's by its folder and its
  // /health, never stopped by a name.
  const running = await ownServer(work);
  if (running !== undefined) {
    const pid = listenersUnder(realpathSync(work)).find(each => each.port === running)?.pid;
    if (pid === undefined) {
      return {
        problem: `a server of your own is running in the copy, on :${String(running)}, and is not one this command can stop — stop it (plitzi server stop --port ${String(running)}), and ${again}: two servers on one copy fight over its state`
      };
    }

    stopListener(pid);
    await stoppedAnswering(running);
    process.stderr.write(
      `· stopped your own server on :${String(running)}: it held the copy's state, and the copy is served for this command — start it again after, if you want it\n`
    );
  }

  const scripts = await scriptsOf(work);
  const name = ['start', 'start:dev'].find(each => Object.hasOwn(scripts, each));
  const script = name === undefined ? undefined : scripts[name];
  if (!script) {
    return { problem: 'the project has no start or start:dev script to serve the copy with' };
  }

  const asked = await freePort();
  // Where the server says it took: the port asked can be taken before it binds — agents checking at once — and a server
  // while developing takes the next free one (asked 61515, it took 62189, and the check waited on 61515).
  const record = path.join(PROJECT_TMP, 'plitzi-cache', 'acceptance-server.json');
  await fs.rm(path.join(work, record), { force: true });
  const env = (await fs.readFile(path.join(root, '.env'), 'utf-8').catch(() => undefined)) ?? '';
  // What the server says goes to a log in the task's cache: when it does not answer, its last lines say why.
  const logFile = path.join(cache, 'acceptance-server.log');
  const log = await fs.open(logFile, 'w');
  const child = spawn(script, {
    cwd: work,
    shell: true,
    stdio: ['ignore', log.fd, log.fd],
    ...TREE,
    env: {
      ...process.env,
      ...Object.fromEntries(
        env
          .split('\n')
          .map(line => line.trim())
          .filter(line => line !== '' && !line.startsWith('#') && line.includes('='))
          .map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)])
      ),
      PORT: String(asked),
      [SERVER_RECORD_ENV]: record,
      PATH: `${path.join(root, 'node_modules', '.bin')}${path.delimiter}${process.env.PATH ?? ''}`
    }
  });
  const stop = (): void => {
    stopTree(child, { group: true });
  };
  const where = await answeringWhere(path.join(work, record), asked, 60_000);
  const port = where ?? asked;
  const url = `http://127.0.0.1:${String(port)}`;
  await log.close();
  if (where === undefined) {
    stop();
    const said = tail((await fs.readFile(logFile, 'utf-8').catch(() => '')).trim());

    return {
      problem: [
        `the copy's server did not answer on ${url} within a minute — a server of your own still running in the copy (npm start) is the usual cause: stop it and ${again}. What it said (${logFile}):`,
        ...said
      ].join('\n')
    };
  }

  // Kept past this command: let go of, so this process ends without it — its pid, for the watchdog that stops it.
  const keep = (): number | undefined => {
    child.unref();

    return child.pid;
  };

  return { url, port, stop, keep };
};

/** The copy being served for a task's acceptance — started early, beside the project's checks. */
export type Serving = ReturnType<typeof serveCopy>;

/**
 * The copy served for `acceptance` from now, while the project's checks run — its start was a few seconds after them
 * on every check and complete; none when no line names the served copy.
 */
export const serveForAcceptance = (
  acceptance: readonly Acceptance[],
  { work, root, cache }: { work: string; root: string; cache: string }
): Serving | undefined =>
  acceptance.filter(isChecked).some(each => namesServedCopy(each.check)) ? serveCopy(work, root, cache) : undefined;

/** A copy served early and not used — the checks failed first, or a refusal came: stopped. */
export const letGo = async (serving: Serving | undefined): Promise<void> => {
  const served = await serving;
  if (served && !('problem' in served)) {
    served.stop();
  }
};

/** A `plitzi` on the path that is this CLI: a check runs the version the run is worked with, not another installed. */
const cliShim = async (cache: string): Promise<string> => {
  const dir = path.join(cache, 'acceptance-bin');
  await fs.mkdir(dir, { recursive: true });
  const shim = path.join(dir, 'plitzi');
  await fs.writeFile(shim, `#!/bin/sh\nexec "${process.execPath}" "${process.argv[1]}" "$@"\n`, { mode: 0o755 });
  // Windows runs a `.cmd` where a POSIX shell runs the script above.
  if (process.platform === 'win32') {
    await fs.writeFile(`${shim}.cmd`, `@"${process.execPath}" "${process.argv[1]}" %*\r\n`);
  }

  return dir;
};

/** Every checked line of `acceptance`, run in `work`: what each answered. None checked, none run. */
/** How many acceptance lines run at once on one served copy: each a browser, as a look's commands are. */
const ACCEPTANCE_AT_ONCE = 2;

/** A line's exit that answers nothing: a page command that could not read (2), a command not found or not runnable. */
const isUnanswered = (code: number): boolean => code === UNANSWERED_EXIT || code === 126 || code === 127;

export const checkAcceptance = async (
  acceptance: readonly Acceptance[],
  {
    work,
    root,
    cache,
    onLine,
    serving
  }: {
    work: string;
    root: string;
    cache: string;
    /** The copy already being served (`serveForAcceptance`): used, rather than started now. */
    serving?: Serving;
    /** Each line as it starts — and again, once more after a failure: what a long check is at. */
    onLine?: (index: number, total: number, said: string, again: boolean) => void;
  }
): Promise<AcceptanceResult[]> => {
  const checked = acceptance.filter(isChecked);
  if (checked.length === 0) {
    return [];
  }

  const served = checked.some(each => namesServedCopy(each.check))
    ? await (serving ?? serveCopy(work, root, cache))
    : undefined;
  // A copy lent by the caller is the caller's to stop (`letGo`): stopped here, the approved tasks' lines `task complete`
  // runs next on it read "nothing answers" — a run's t-room-side was refused three times as breaking five of them.
  const own = serving === undefined;
  if (served && 'problem' in served) {
    return checked.map(each => ({
      said: each.said,
      check: each.check,
      ok: false,
      output: [served.problem],
      unanswered: true
    }));
  }

  const bin = await cliShim(cache);
  const values: Record<string, string> = served
    ? { PLITZI_URL: served.url, PLITZI_PORT: String(served.port), PORT: String(served.port) }
    : {};
  const run = (each: { check: string }) =>
    runScript(work, withServedValues(each.check, values), root, { env: values, bin: [bin] });
  try {
    // Two at a time: a run's t-body-type ran a measure, then a check of four pages, one after the other — 11 s
    // of its 18 s check, each line a browser of its own the other did not wait on.
    const results: AcceptanceResult[] = await inTurns(
      checked.map((each, index) => async () => {
        onLine?.(index, checked.length, each.said, false);
        const { code, output } = await run(each);

        return {
          said: each.said,
          check: each.check,
          ok: code === 0,
          ...(code === 0 ? {} : { output: tail(output) })
        };
      }),
      ACCEPTANCE_AT_ONCE
    );

    // Each line that failed, once more after the others and on its own: what a slow server failed passes now, and
    // says it did only the second time; a broken line fails again, with what it printed then.
    for (const [at, result] of results.entries()) {
      if (result.ok) {
        continue;
      }

      onLine?.(at, checked.length, result.said, true);
      const { code, output } = await run(checked[at]);
      results[at] =
        code === 0
          ? { said: result.said, check: result.check, ok: true, firstFailed: result.output ?? [] }
          : { ...result, output: tail(output), ...(isUnanswered(code) ? { unanswered: true as const } : {}) };
    }

    return results;
  } finally {
    if (own) {
      served?.stop();
    }
  }
};
