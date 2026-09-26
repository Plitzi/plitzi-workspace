// Preloaded into every server the bench starts (`--import`), compiled to JavaScript first so it adds nothing to what
// is measured but itself. It reports what only the process knows about its memory, which no reading from outside can
// split: the V8 heap, its code space, and what lives off it. One JSON line every half second on stderr, prefixed so
// the bench can pick them out of the server's own output.
import { getHeapSpaceStatistics } from 'node:v8';

import { PROBE_PREFIX } from './protocol.ts';

import type { ProbeSample } from './protocol.ts';

const report = (): void => {
  const usage = process.memoryUsage();
  const codeSpace = getHeapSpaceStatistics()
    .filter(space => space.space_name === 'code_space' || space.space_name === 'code_large_object_space')
    .reduce((total, space) => total + space.space_size, 0);
  const sample: ProbeSample = {
    t: Date.now(),
    rss: usage.rss,
    heapUsed: usage.heapUsed,
    heapTotal: usage.heapTotal,
    external: usage.external,
    arrayBuffers: usage.arrayBuffers,
    codeSpace
  };
  process.stderr.write(`${PROBE_PREFIX}${JSON.stringify(sample)}\n`);
};

setInterval(report, 500).unref();
