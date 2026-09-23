import { createMemoryJobQueue } from './memoryQueue';
import { describeJobQueue, describeKv } from './testing/jobQueueContract';
import { createMemoryKv } from '../runtime/memoryKv';

/** The in-process stores keep the same contract the shared ones do — they are what a test against a worker runs on. */
describeJobQueue('memory', () => Promise.resolve({ queue: createMemoryJobQueue(), clear: () => Promise.resolve() }));
describeKv('memory', () => Promise.resolve({ kv: createMemoryKv(), clear: () => Promise.resolve() }));
