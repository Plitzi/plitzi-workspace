import { runBenchmarkStreaming } from './scenarios';

import type { BenchmarkRequest, BenchmarkWorkerMessage } from './shared';

// Runs the benchmark off the main thread so the page stays responsive, streaming each scenario back as it finishes.
// One worker, not many: benchmarks must NOT run in parallel — concurrent workloads contend for the same cores and
// corrupt the timings. The win here is a non-blocking UI and measurements isolated from React/raf, not parallelism.
const ctx = self as unknown as {
  postMessage: (message: BenchmarkWorkerMessage) => void;
  onmessage: ((event: MessageEvent<BenchmarkRequest>) => void) | null;
};

ctx.onmessage = event => {
  runBenchmarkStreaming(event.data.reps, scenario => ctx.postMessage({ type: 'scenario', scenario }));
  ctx.postMessage({ type: 'done' });
};
