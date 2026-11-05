import { performance } from 'node:perf_hooks';
import { getHeapStatistics } from 'node:v8';

/** How full a process is: what it holds against what it may hold, in bytes. */
export type MemoryReading = { usedBytes: number; limitBytes: number };

/**
 * What this process may hold: its container's memory limit, or V8's heap limit where it has none.
 *
 * Read once: the container's limit is a file of the cgroup, and it does not move while the process lives.
 * `constrainedMemory()` answers 0 when no limit is known, and some platforms answer the largest integer they hold.
 */
export const processMemoryLimit = (): number => {
  const constrained = process.constrainedMemory();

  return constrained > 0 && constrained < Number.MAX_SAFE_INTEGER ? constrained : getHeapStatistics().heap_size_limit;
};

/**
 * The process's resident memory against its limit, read at most every 100 ms — what the engine's runs and a runner's
 * invocations are admitted by.
 *
 * Reading it is a system call (a file of `/proc` on Linux), and a call costs a tenth of a millisecond: asked on every
 * run it would be a tenth of a call's own cost. Memory does not climb far in 100 ms.
 */
export const sampleProcessMemory = (): (() => MemoryReading) => {
  const limitBytes = processMemoryLimit();
  let usedBytes = process.memoryUsage.rss();
  let readAt = performance.now();

  return () => {
    const now = performance.now();
    if (now - readAt >= 100) {
      usedBytes = process.memoryUsage.rss();
      readAt = now;
    }

    return { usedBytes, limitBytes };
  };
};
