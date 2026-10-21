import { spawn } from 'node:child_process';

import { describe, expect, it } from 'vitest';

import { descendantsOf, stopTree } from './processes';

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
