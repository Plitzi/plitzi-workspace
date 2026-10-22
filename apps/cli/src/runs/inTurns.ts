/**
 * Each job run, `limit` at a time, its answers in the order the jobs were given: a look's commands, a check's acceptance
 * lines — each a browser, enough to overlap and few enough not to starve the servers they read.
 */
export const inTurns = async <T>(jobs: readonly (() => Promise<T>)[], limit: number): Promise<T[]> => {
  const answers = new Array<T>(jobs.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < jobs.length) {
      const at = next;
      next += 1;
      answers[at] = await jobs[at]();
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, jobs.length) }, worker));

  return answers;
};
