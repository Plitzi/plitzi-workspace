import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { descendantsOf, listenersUnder, stopListenersUnder, stopTree } from './processes';

const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);

    return true;
  } catch {
    return false;
  }
};

const until = async (ok: () => boolean, ms = 5000): Promise<boolean> => {
  for (const started = Date.now(); Date.now() - started < ms;) {
    if (ok()) {
      return true;
    }

    await new Promise(resolve => setTimeout(resolve, 50));
  }

  return ok();
};

/**
 * A server started through a shell is the shell's child, not the shell: Linux's `sh` (dash) runs the command under it,
 * where macOS's execs into it. Stopping the shell alone left the server listening — and, under the CI, the test
 * worker that started it waiting on it for six hours.
 */
describe('stopTree', () => {
  it('stops what the shell started too, not the shell alone', async () => {
    // Two commands: no shell execs into the first, so the server is its child on every system.
    const child = spawn('node -e "setInterval(() => {}, 1000)"; true', { shell: true, stdio: 'ignore' });
    const pid = child.pid ?? 0;
    expect(await until(() => descendantsOf(pid).length > 0)).toBe(true);
    const [server] = descendantsOf(pid);

    stopTree(child);

    expect(await until(() => !alive(server))).toBe(true);
  });
});

// velada-fidelity: the servers its agents started in their copies listened on after the finish removed the copies.
describe.skipIf(process.platform === 'win32')('the servers left listening in a run’s folders', () => {
  it('finds a server by the folder it runs in, and stops it — none outside it', async () => {
    const dir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-listeners-')));
    const copy = path.join(dir, 'tasks', 't-home', 'cache', 'work');
    await fs.mkdir(copy, { recursive: true });
    const server = spawn(
      process.execPath,
      ['-e', "require('node:http').createServer((q, r) => r.end('ok')).listen(0, '127.0.0.1')"],
      { cwd: copy, stdio: 'ignore' }
    );
    const pid = server.pid ?? 0;
    try {
      expect(await until(() => listenersUnder(dir).some(each => each.pid === pid), 10_000)).toBe(true);
      expect(listenersUnder(path.join(dir, 'elsewhere'))).toEqual([]);

      const stopped = stopListenersUnder(dir);
      expect(stopped).toEqual([expect.objectContaining({ pid, cwd: copy })]);
      expect(await until(() => !alive(pid))).toBe(true);
    } finally {
      server.kill();
      await fs.rm(dir, { recursive: true, force: true });
    }
  }, 20_000);
});
