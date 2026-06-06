/* eslint-disable no-console */
import { BOLD, DIM, GREEN, RESET, YELLOW, padStart, rankCell } from './benchShared';
import { runReactBench } from './reactBench';

import type { ReactRow, RenderSample } from './reactBench';

// Terminal runner for the React-render comparison. Run with: `npm run bench:react`. Mounts a deeply nested tree as
// (1) plain React context providers, (2) scoped <StoreProvider inherit="live">, (3) disconnected <StoreProvider>,
// and ranks them per depth — winner in green, the rest annotated with how many times slower — so the gain/loss of
// replacing nested context is read at a glance.

const reps = Number(process.env.BENCH_REPS) || 5;
const updates = Number(process.env.BENCH_UPDATES) || 50;
const { contestants, rows } = runReactBench(undefined, reps, updates);

const COL = 18;
const header = ['depth', ...contestants.map(c => c.id)].map(label => padStart(label, COL)).join('');

const section = (title: string, value: (row: ReactRow, id: string) => number, fmt: (n: number) => string): void => {
  console.log(`${BOLD}${title}${RESET}`);
  console.log(`${DIM}${header}${RESET}`);
  for (const row of rows) {
    const values = contestants.map(contestant => value(row, contestant.id));
    const best = Math.min(...values);
    const cells = [padStart(String(row.depth), COL), ...values.map(v => rankCell(v, best, COL, fmt))];
    console.log(cells.join(''));
  }

  console.log('');
};

const ms = (n: number) => `${n.toFixed(2)}ms`;
const count = (n: number) => n.toFixed(0);
const sample = (row: ReactRow, id: string, kind: 'mount' | 'update'): RenderSample => row[kind][id];

console.log(`\n${BOLD}@plitzi/sdk-store — nested providers vs React context (render benchmark)${RESET}`);
console.log(`${DIM}node ${process.version} · jsdom + react-dom · median of ${reps} reps · lower is faster · winner in green${RESET}\n`);

section('Mount — stand the nested tree up (ms)', (row, id) => sample(row, id, 'mount').ms, ms);
section(`Update — ${updates} updates to the value the leaf reads (ms)`, (row, id) => sample(row, id, 'update').ms, ms);
section(
  `Update — components re-rendered across ${updates} updates`,
  (row, id) => sample(row, id, 'update').renders,
  count
);

// Bottom line at the deepest tree: the two numbers that decide whether to drop nested context — how much faster
// updates land, and how many fewer components React has to touch per update.
const deepest = rows[rows.length - 1];
const ctxUpdate = deepest.update.context;
const storeUpdate = deepest.update.store;
const speedup = ctxUpdate.ms / storeUpdate.ms;
const ctxPerUpdate = ctxUpdate.renders / updates;
const storePerUpdate = storeUpdate.renders / updates;
const renderFactor = ctxPerUpdate / storePerUpdate;

console.log(`${BOLD}Bottom line at depth ${deepest.depth} (${deepest.depth} nested providers)${RESET}`);
console.log(
  `  update speed   ${GREEN}store ${storeUpdate.ms.toFixed(2)}ms${RESET} vs context ${ctxUpdate.ms.toFixed(2)}ms` +
    `   →  ${GREEN}${speedup.toFixed(1)}× faster${RESET}`
);
console.log(
  `  re-renders     ${GREEN}store ${storePerUpdate.toFixed(1)}/update${RESET} vs context ${ctxPerUpdate.toFixed(0)}/update` +
    `   →  ${GREEN}${renderFactor.toFixed(0)}× fewer${RESET}  ${YELLOW}(context scales with depth)${RESET}`
);

console.log('');
for (const contestant of contestants) {
  console.log(`${DIM}${contestant.id.padEnd(10)} — ${contestant.label}${RESET}`);
}

console.log('');
