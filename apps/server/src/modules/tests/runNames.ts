/**
 * Names of this run's own for what the integration tests make in a database they share with every other run on the
 * machine — another session, the workspace's suite beside a package's — which emptied and dropped each other's tables
 * when the names were fixed. A name carries the process that made it, `<base>_<pid>`, so what a run killed before its
 * `afterAll` left behind is told apart from what a run still going holds, and dropped by the next.
 */

/** `<base>_<pid>`, this process's. */
export const runName = (base: string): string => `${base}_${String(process.pid)}`;

const isGone = (pid: number): boolean => {
  try {
    // Signal 0 only asks whether the process is there: it is, or it is someone else's (`EPERM`).
    process.kill(pid, 0);

    return false;
  } catch (error) {
    return error instanceof Error && 'code' in error && error.code === 'ESRCH';
  }
};

/** Whether `name` is one `runName(base)` gave a process that is no longer running — never this one's. */
export const leftByGoneRun = (name: string, base: string): boolean => {
  if (!name.startsWith(`${base}_`)) {
    return false;
  }

  const pid = /^(\d+)(?:_|$)/.exec(name.slice(base.length + 1))?.[1];

  return pid !== undefined && Number(pid) !== process.pid && isGone(Number(pid));
};
