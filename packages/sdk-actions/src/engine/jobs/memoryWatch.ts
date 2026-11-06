import { getHeapStatistics } from 'node:v8';

/**
 * How near its memory a worker is: what its jobs are marked by while it holds them, so that should it die, the queue
 * knows the jobs took it down (`heartbeat`'s `nearMemoryLimit`) — and sends them to a larger worker, not its twin.
 */

/** A process's memory, in MiB: what it holds, and its JavaScript heap beside the most V8 lets it grow to. */
export type MemoryReading = { rssMb: number; heapUsedMb: number; heapLimitMb: number };

/** The share of a limit past which a worker is near it: a kernel or V8 ends it at the limit, not before. */
export const NEAR_MEMORY_SHARE = 0.85;

const MIB = 1024 * 1024;

/** This process's memory: `rss()` alone, which reads no more than it must, and V8's heap. */
export const readProcessMemory = (): MemoryReading => {
  const heap = getHeapStatistics();

  return {
    rssMb: process.memoryUsage.rss() / MIB,
    heapUsedMb: heap.used_heap_size / MIB,
    heapLimitMb: heap.heap_size_limit / MIB
  };
};

/**
 * Whether a worker is near its memory: what it holds near what its container may (`limitMb`), or its heap near what V8
 * lets it grow to — which, sized from the container, is often the limit a job meets first ("heap out of memory").
 */
export const nearMemory = (reading: MemoryReading, limitMb: number): boolean =>
  reading.rssMb >= limitMb * NEAR_MEMORY_SHARE || reading.heapUsedMb >= reading.heapLimitMb * NEAR_MEMORY_SHARE;

/** The reading in words, beside the limit: `450 of 512 MiB held · heap 240 of 259 MiB`. */
export const memoryWords = (reading: MemoryReading, limitMb: number): string =>
  `${String(Math.round(reading.rssMb))} of ${String(limitMb)} MiB held · heap ${String(Math.round(reading.heapUsedMb))} ` +
  `of ${String(Math.round(reading.heapLimitMb))} MiB`;
