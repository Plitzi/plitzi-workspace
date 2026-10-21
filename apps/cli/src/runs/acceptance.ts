import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';
import { projectMark } from '@plitzi/sdk-shared/project';

import { stopKept } from './lingering';
import { stopTree, TREE } from './processes';
import { runScript, scriptsOf, tail } from '../commands/verify';
import { DEV_SERVER_FILE } from '../scaffold/paths';

import type { Acceptance, AcceptanceResult } from './model';

/**
 * A task's acceptance, checked by the commands its plan gives: each run in the task's copy as `complete` runs
 * the project's checks, passing on exit 0 — so what is asked is held by the CLI, not only read by the lead at review.
 * `plitzi` in a check is this CLI, the one the run is worked with; `$PLITZI_URL`, the copy served by its own start
 * script on a free port, for as long as the checks take.
 */

const isChecked = (each: Acceptance): each is { said: string; check: string } => typeof each !== 'string';

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

/** Until something answers on `url`, or `ms` pass: whether it did. */
export const answering = async (url: string, ms: number): Promise<boolean> => {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const ok = await fetch(url).then(
      () => true,
      () => false
    );
    if (ok) {
      return true;
    }

    await new Promise(resolve => setTimeout(resolve, 300));
  }

  return false;
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
  const health: unknown = await fetch(`http://127.0.0.1:${String(port)}/health`, { signal: AbortSignal.timeout(1_000) })
    .then(async (response): Promise<unknown> => response.json())
    .catch(() => undefined);
  if (!isRecord(health)) {
    return undefined;
  }

  return typeof health.Instance !== 'string' || health.Instance === projectMark(work) ? port : undefined;
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
  const running = await ownServer(work);
  if (running !== undefined) {
    return {
      problem: `a server of your own is running in the copy, on :${String(running)} — stop it, and ${again}: the copy is served for it, and two servers on one copy fight over its state`
    };
  }

  const scripts = await scriptsOf(work);
  const name = ['start', 'start:dev'].find(each => Object.hasOwn(scripts, each));
  const script = name === undefined ? undefined : scripts[name];
  if (!script) {
    return { problem: 'the project has no start or start:dev script to serve the copy with' };
  }

  const port = await freePort();
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
      PORT: String(port),
      PATH: `${path.join(root, 'node_modules', '.bin')}${path.delimiter}${process.env.PATH ?? ''}`
    }
  });
  const stop = (): void => {
    stopTree(child, { group: true });
  };
  const url = `http://127.0.0.1:${String(port)}`;
  const answered = await answering(url, 60_000);
  await log.close();
  if (!answered) {
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
export const checkAcceptance = async (
  acceptance: readonly Acceptance[],
  { work, root, cache }: { work: string; root: string; cache: string }
): Promise<AcceptanceResult[]> => {
  const checked = acceptance.filter(isChecked);
  if (checked.length === 0) {
    return [];
  }

  const served = checked.some(each => namesServedCopy(each.check)) ? await serveCopy(work, root, cache) : undefined;
  if (served && 'problem' in served) {
    return checked.map(each => ({ said: each.said, check: each.check, ok: false, output: [served.problem] }));
  }

  const bin = await cliShim(cache);
  const values: Record<string, string> = served
    ? { PLITZI_URL: served.url, PLITZI_PORT: String(served.port), PORT: String(served.port) }
    : {};
  const run = (each: { check: string }) =>
    runScript(work, withServedValues(each.check, values), root, { env: values, bin: [bin] });
  try {
    const results: AcceptanceResult[] = [];
    for (const each of checked) {
      const { code, output } = await run(each);
      results.push({
        said: each.said,
        check: each.check,
        ok: code === 0,
        ...(code === 0 ? {} : { output: tail(output) })
      });
    }

    // Each line that failed, once more after the others and on its own: what a slow server failed passes now, and
    // says it did only the second time; a broken line fails again, with what it printed then.
    for (const [at, result] of results.entries()) {
      if (result.ok) {
        continue;
      }

      const { code, output } = await run(checked[at]);
      results[at] =
        code === 0
          ? { said: result.said, check: result.check, ok: true, firstFailed: result.output ?? [] }
          : { ...result, output: tail(output) };
    }

    return results;
  } finally {
    served?.stop();
  }
};
