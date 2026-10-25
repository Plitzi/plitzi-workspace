import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { projectMark } from '@plitzi/sdk-shared/project';

import { projectServers, serverReset, serverStop } from './server';

import type { ChildProcess } from 'node:child_process';

const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);

    return true;
  } catch {
    return false;
  }
};

const until = async (ok: () => boolean | Promise<boolean>, ms = 10_000): Promise<boolean> => {
  for (const started = Date.now(); Date.now() - started < ms;) {
    if (await ok()) {
      return true;
    }

    await new Promise(resolve => setTimeout(resolve, 50));
  }

  return ok();
};

/** A server listening from `cwd` whose `/health` says it serves `instance` — or answers no Instance at all. */
const serve = (cwd: string, instance?: string): ChildProcess =>
  spawn(
    process.execPath,
    [
      '-e',
      "const [i] = process.argv.slice(1); require('node:http').createServer((q, r) => { r.setHeader('content-type', 'application/json'); r.end(JSON.stringify(i ? { Instance: i } : {})); }).listen(0, '127.0.0.1')",
      instance ?? ''
    ],
    { cwd, stdio: 'ignore' }
  );

// An agent freed a hung heredoc with `pkill -f "cat"` and took the machine down — a server is stopped as this
// folder's, told by where it listens from and what its /health says, never by a name.
describe.skipIf(process.platform === 'win32')('plitzi server stop', () => {
  let root: string;
  const started: ChildProcess[] = [];

  beforeEach(async () => {
    root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-server-')));
    await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'site', private: true }));
    vi.spyOn(process, 'cwd').mockReturnValue(root);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    process.exitCode = undefined;
  });

  afterEach(async () => {
    started.splice(0).forEach(each => each.kill());
    vi.restoreAllMocks();
    process.exitCode = undefined;
    await fs.rm(root, { recursive: true, force: true });
  });

  const listening = async (child: ChildProcess) => {
    started.push(child);
    const pid = child.pid ?? 0;
    expect(await until(async () => (await projectServers(root)).some(each => each.pid === pid))).toBe(true);
    const found = (await projectServers(root)).find(each => each.pid === pid);
    if (!found) {
      throw new Error(`pid ${String(pid)} never listened`);
    }

    return found;
  };

  it('stops this folder’s server on its port, said as stopped', async () => {
    const mine = await listening(serve(root, projectMark(root)));
    expect(mine.serves).toBe('this');

    await serverStop({ port: mine.port });

    expect(await until(() => !alive(mine.pid))).toBe(true);
    expect(process.exitCode).toBeUndefined();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining(`Stopped ${String(mine.port)}`));
  }, 20_000);

  it('leaves one that does not say it serves this folder, and fails', async () => {
    const other = await listening(serve(root, 'another-mark'));
    const none = await listening(serve(root));
    expect([other.serves, none.serves]).toEqual(['another', 'unknown']);

    await serverStop({});

    expect(alive(other.pid) && alive(none.pid)).toBe(true);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('No server of this project to stop.'));

    await serverStop({ port: other.port });

    expect(alive(other.pid)).toBe(true);
    expect(process.exitCode).toBe(1);
  }, 20_000);

  it('knows nothing under its own tmp/ — a run’s copy is its own folder', async () => {
    const copy = path.join(root, 'tmp', 'plitzi-runs', 'r', 'tasks', 't', 'cache', 'work');
    await fs.mkdir(copy, { recursive: true });
    const child = serve(copy, projectMark(copy));
    started.push(child);
    const pid = child.pid ?? 0;
    expect(await until(async () => (await projectServers(copy)).some(each => each.pid === pid))).toBe(true);

    expect((await projectServers(root)).some(each => each.pid === pid)).toBe(false);
  }, 20_000);

  it('fails on a port nothing of this project listens on', async () => {
    await serverStop({ port: 1 });

    expect(process.exitCode).toBe(1);
  });

  // `server stop --port` said "nothing of this project listens" for a server that had already exited.
  it('says a port nothing listens on is free, not held by another folder', async () => {
    await serverStop({ port: 1 });

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Nothing listens on port 1'));
  });

  // A reviewer's page play used the demo's data up, and emptying the copy's sqlite by hand was the way back.
  it('resets what the server keeps to a cold start, and refuses while a server of the folder runs', async () => {
    await fs.mkdir(path.join(root, 'state'));
    await fs.writeFile(path.join(root, 'state', 'kv.json'), '{}');
    const mine = await listening(serve(root, projectMark(root)));

    await serverReset({});

    expect(process.exitCode).toBe(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining(`running on :${String(mine.port)}`));
    expect(await fs.readdir(path.join(root, 'state'))).toEqual(['kv.json']);

    await serverStop({});
    expect(await until(() => !alive(mine.pid))).toBe(true);
    process.exitCode = undefined;
    await serverReset({ dryRun: true });
    expect(await fs.readdir(path.join(root, 'state'))).toEqual(['kv.json']);

    await serverReset({});

    expect(process.exitCode).toBeUndefined();
    await expect(fs.access(path.join(root, 'state'))).rejects.toThrow();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Removed state/ (kv.json)'));
  }, 20_000);
});
