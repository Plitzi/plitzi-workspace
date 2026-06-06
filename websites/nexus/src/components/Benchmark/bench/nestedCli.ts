/* eslint-disable no-console */
import { BOLD, DIM, GREEN, RESET, YELLOW, padStart, rankCell } from './benchShared';
import { runNestedScaling } from './nestedScope';

import type { NestedRow } from './nestedScope';

// Terminal runner for the nested scope-chain scaling benchmark. Run with: `npm run bench:nested`. Models a tree of N
// nested providers three ways — nested React context overlays, a live <StoreProvider> chain, and disconnected scopes
// — and ranks them per depth (winner in green, the rest tagged with how many times slower) so the gain/loss of each
// approach, plus which costs grow with nesting depth, is read at a glance. Context is O(depth²) so it is capped and
// shown as `—` beyond that depth.

const reps = Number(process.env.BENCH_REPS) || 7;
const { rows } = runNestedScaling(undefined, reps);

const COL = 21;
const ms = (n: number) => `${n.toFixed(2)}ms`;

// One head-to-head across N scenarios, compared per depth: fastest (lowest, skipping `—`) in green, the rest tagged
// with their `×`.
const matchup = (title: string, note: string, ids: string[]): void => {
  console.log(`${BOLD}${title}${RESET}`);
  console.log(`${DIM}${note}${RESET}`);
  console.log(`${DIM}${['depth', ...ids].map(label => padStart(label, COL)).join('')}${RESET}`);
  for (const row of rows) {
    const values = ids.map(id => row.results[id]);
    const best = Math.min(...values.filter(v => !Number.isNaN(v)));
    console.log([padStart(String(row.depth), COL), ...values.map(v => rankCell(v, best, COL, ms))].join(''));
  }

  console.log('');
};

console.log(`\n${BOLD}@plitzi/nexus — nested providers scaling${RESET}`);
console.log(`${DIM}node ${process.version} · median of ${reps} reps · ms by nesting depth · lower is faster · winner in green${RESET}`);
console.log(`${DIM}ctx = nested React context overlays · live = <StoreProvider inherit="live"> · iso = disconnected scopes${RESET}\n`);

matchup(
  'Read a shared value — context vs live chain vs disconnected',
  'A leaf reads an ancestor source. Context merge is precomputed (O(1)); the live chain caches its fall-through; disconnected reads its own.',
  ['read-ctx', 'read-live', 'read-iso']
);
matchup(
  'Write a value — context storm vs live cascade vs local',
  'A root source changes: context rebuilds every overlay and wakes every level (O(depth²)); the live chain cascades and wakes only subscribers; a leaf-local write is flat.',
  ['write-ctx', 'write-root', 'write-leaf']
);
matchup(
  'Write with unwatched sibling branches — lazy attachment pruning',
  'Same root write, but the tree also has 8 sibling branches with no subscribers. Lazy attachment never connects them, so write-bushy tracks write-root instead of paying ~9× for the dead branches.',
  ['write-root', 'write-bushy']
);
matchup(
  'Mount the tree — context overlays vs live chain vs disconnected',
  'Standing the providers up: context copies the growing merged map at every level (O(depth²)); stores allocate one scope per level.',
  ['mount-ctx', 'mount-live', 'mount-iso']
);

// Which costs actually grow as the tree gets deeper — the targets for optimization before scaling to thousands.
const first = rows[0] as NestedRow;
const last = rows[rows.length - 1] as NestedRow;
const depthFactor = last.depth / first.depth;
const SCALING = ['mount-live', 'mount-iso', 'read-live', 'read-iso', 'write-root', 'write-leaf'];

console.log(`${BOLD}scaling — depth ${first.depth} → ${last.depth} (${depthFactor.toFixed(0)}× deeper, store scenarios)${RESET}`);
for (const id of SCALING) {
  const slowdown = last.results[id] / (first.results[id] || 1);
  const linear = slowdown > depthFactor * 0.5;
  const verdict = linear ? `${YELLOW}~O(depth) — grows with nesting${RESET}` : `${GREEN}flat / sub-linear${RESET}`;
  console.log(`  ${id.padEnd(12)} ${padStart(`${slowdown.toFixed(1)}× slower`, 14)}   ${verdict}`);
}

console.log('');
