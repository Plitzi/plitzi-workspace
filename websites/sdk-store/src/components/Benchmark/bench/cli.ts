/* eslint-disable no-console */
import { runBenchmark } from './scenarios';

// Terminal runner for the store benchmark. Run with: `npm run bench` (uses vite-node so the `@plitzi/sdk-store`
// source alias and import.meta.env resolve exactly like the website does).

const GREEN = '\x1b[32m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

const padEnd = (value: string, width: number) => value.padEnd(width);
const padStart = (value: string, width: number) => value.padStart(width);

const reps = Number(process.env.BENCH_REPS) || 9;
const { scenarios } = runBenchmark(reps);

console.log(`\n${BOLD}@plitzi/sdk-store — store benchmark${RESET}`);
console.log(`${DIM}node ${process.version} · median of ${reps} reps · lower is faster · winner in green${RESET}`);

for (const scenario of scenarios) {
  const ranked = [...scenario.results].sort((a, b) => a.ms - b.ms);
  const fastest = ranked[0]?.ms ?? 0;

  console.log(`\n${BOLD}${scenario.label}${RESET}`);
  console.log(`${DIM}${scenario.description}${RESET}`);

  for (const [index, result] of ranked.entries()) {
    const name = padEnd(result.name, 22);
    const wakes = padStart(result.wakes.toLocaleString(), 9);
    const ms = padStart(`${result.ms.toFixed(2)} ms`, 11);
    const best = padStart(`best ${result.min.toFixed(2)}`, 12);
    const relative = fastest > 0 ? padStart(`${(result.ms / fastest).toFixed(1)}×`, 6) : padStart('—', 6);
    const line = `  ${name} ${wakes} wakes ${ms} ${DIM}${best}${RESET} ${DIM}${relative}${RESET}`;
    console.log(index === 0 ? `${GREEN}${line}${RESET}` : line);
  }
}

console.log('');
