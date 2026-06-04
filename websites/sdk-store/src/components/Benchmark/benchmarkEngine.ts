// Public entry for the benchmark. The per-store implementations live in ./bench (one file each), composed by
// ./bench/scenarios. Re-exported here so the UI and the CLI share the exact same code.
export { runBenchmark } from './bench/scenarios';
export type { BenchmarkResult, LibResult, ScenarioResult } from './bench/shared';
