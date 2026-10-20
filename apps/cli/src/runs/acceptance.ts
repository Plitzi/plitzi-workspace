import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';

import { runScript, scriptsOf, tail } from '../commands/verify';

import type { Acceptance, AcceptanceResult } from './model';

/**
 * A task's acceptance, checked by the commands its plan gives (RFC 0028): each run in the task's copy as `complete` runs
 * the project's checks, passing on exit 0 — so what is asked is held by the CLI, not only read by the lead at review.
 * `plitzi` in a check is this CLI, the one the run is worked with; `$PLITZI_URL`, the copy served by its own start
 * script on a free port, for as long as the checks take.
 */

const isChecked = (each: Acceptance): each is { said: string; check: string } => typeof each !== 'string';

const freePort = (): Promise<number> =>
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
const answering = async (url: string, ms: number): Promise<boolean> => {
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

/** The copy served by its own start script on a free port, quietly: what `$PLITZI_URL` names. */
const serveCopy = async (
  work: string,
  root: string
): Promise<{ url: string; stop: () => void } | { problem: string }> => {
  const scripts = await scriptsOf(work);
  const name = ['start', 'start:dev'].find(each => Object.hasOwn(scripts, each));
  const script = name === undefined ? undefined : scripts[name];
  if (!script) {
    return { problem: 'a check names $PLITZI_URL, and the project has no start script to serve the copy with' };
  }

  const port = await freePort();
  const env = (await fs.readFile(path.join(root, '.env'), 'utf-8').catch(() => undefined)) ?? '';
  const child = spawn(script, {
    cwd: work,
    shell: true,
    stdio: 'ignore',
    detached: process.platform !== 'win32',
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
    // The start script's whole process group: a shell and the server it started.
    try {
      if (child.pid !== undefined && process.platform !== 'win32') {
        process.kill(-child.pid, 'SIGTERM');
      } else {
        child.kill('SIGTERM');
      }
    } catch {
      // Already gone.
    }
  };
  const url = `http://127.0.0.1:${String(port)}`;
  if (!(await answering(url, 60_000))) {
    stop();

    return { problem: `the copy's server did not answer on ${url} within a minute` };
  }

  return { url, stop };
};

/** A `plitzi` on the path that is this CLI: a check runs the version the run is worked with, not another installed. */
const cliShim = async (cache: string): Promise<string> => {
  const dir = path.join(cache, 'acceptance-bin');
  await fs.mkdir(dir, { recursive: true });
  const shim = path.join(dir, 'plitzi');
  await fs.writeFile(shim, `#!/bin/sh\nexec "${process.execPath}" "${process.argv[1]}" "$@"\n`, { mode: 0o755 });

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

  const served = checked.some(each => each.check.includes('PLITZI_URL')) ? await serveCopy(work, root) : undefined;
  if (served && 'problem' in served) {
    return checked.map(each => ({ said: each.said, check: each.check, ok: false, output: [served.problem] }));
  }

  const bin = await cliShim(cache);
  try {
    const results: AcceptanceResult[] = [];
    for (const each of checked) {
      const { code, output } = await runScript(work, each.check, root, {
        env: served ? { PLITZI_URL: served.url } : {},
        bin: [bin]
      });
      results.push({
        said: each.said,
        check: each.check,
        ok: code === 0,
        ...(code === 0 ? {} : { output: tail(output) })
      });
    }

    return results;
  } finally {
    served?.stop();
  }
};
