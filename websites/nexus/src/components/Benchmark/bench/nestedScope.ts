import { createStore } from '@plitzi/nexus';

import { medianBy } from './benchShared';
import { guardSink, resetSink, work } from './shared';

import type { StoreApi } from '@plitzi/nexus';

// Models the real builder shape: a deeply nested element tree where every container element (Form, List,
// CollectionContainer, ApiContainer…) opens an `<StoreProvider inherit="live">` that contributes its own
// `runtime.sources.<name>` and falls through to ancestors for everything else. Each scope here is one such live
// store linked to its parent — so a chain of `depth` stores is a tree of `depth` nested providers.
type Source = { value: number; tag: string };
type ScopeState = { runtime: { sources: Record<string, Source> } };

// The source contributed by the root scope and the leaf path under it. A leaf scope reading this resolves it by
// walking the whole chain (own scope has no `s0`), so the cost grows with depth.
const ROOT_SOURCE = 'runtime.sources.s0';
const ROOT_LEAF = 'runtime.sources.s0.value';

export type NestedSample = { depth: number; ms: number; wakes: number };

const makeScope = (i: number): ScopeState => ({ runtime: { sources: { [`s${i}`]: { value: 0, tag: 'el' } } } });

const buildChain = (depth: number): StoreApi<ScopeState>[] => {
  const chain: StoreApi<ScopeState>[] = [createStore<ScopeState>(makeScope(0))];
  for (let i = 1; i < depth; i++) {
    const parent = chain[i - 1];
    chain.push(createStore<ScopeState>(makeScope(i), { parent }));
  }

  return chain;
};

// The disconnected counterpart: each provider is opened WITHOUT `inherit`, so its store has no parent link. The
// React tree is just as deep, but at the store layer the scopes are fully independent — no fall-through reads, no
// cascade writes, no `forwardParentChanges` subscription. Isolates the raw cost of standing up N stripped stores.
const buildIsolatedChain = (depth: number): StoreApi<ScopeState>[] => {
  const chain: StoreApi<ScopeState>[] = [];
  for (let i = 0; i < depth; i++) {
    chain.push(createStore<ScopeState>(makeScope(i)));
  }

  return chain;
};

// The third contestant: nested React context the way the builder uses it today — each provider re-provides the
// inherited value with its own source overlaid (`{ ...parent, [key]: source }`). No store, no chain; the merged map
// is precomputed at each level. This is a plain-JS model of that data flow (no React), so the same operations can be
// priced head to head. It is O(depth²) to build and to update (each level copies the growing map), which is exactly
// why it doesn't scale — so context scenarios are capped at CONTEXT_MAX_DEPTH and reported as skipped beyond it.
export const CONTEXT_MAX_DEPTH = 800;
type ContextLevel = Record<string, Source>;

const buildContextChain = (depth: number): ContextLevel[] => {
  const chain: ContextLevel[] = [{ s0: { value: 0, tag: 'el' } }];
  for (let i = 1; i < depth; i++) {
    chain.push({ ...chain[i - 1], [`s${i}`]: { value: 0, tag: 'el' } });
  }

  return chain;
};

const SKIPPED = Number.NaN;

const constructContext = (depth: number): NestedSample => {
  if (depth > CONTEXT_MAX_DEPTH) {
    return { depth, ms: SKIPPED, wakes: 0 };
  }

  const start = performance.now();
  const chain = buildContextChain(depth);
  const ms = performance.now() - start;
  work(chain.length);

  return { depth, ms, wakes: 0 };
};

// A leaf reads a root source from its own fully-merged context value — O(1), context's one advantage.
const contextRead = (depth: number, reads: number): NestedSample => {
  if (depth > CONTEXT_MAX_DEPTH) {
    return { depth, ms: SKIPPED, wakes: 0 };
  }

  const chain = buildContextChain(depth);
  const leaf = chain[chain.length - 1];
  let acc = 0;

  const start = performance.now();
  for (let i = 0; i < reads; i++) {
    acc += leaf.s0.value;
  }

  work(acc);

  return { depth, ms: performance.now() - start, wakes: 0 };
};

// A root source changes: because every level overlays the inherited value, the whole merged chain is rebuilt and
// every level's consumer re-renders. O(depth) wakes and O(depth²) copying per update — the storm scoped stores avoid.
const contextWrite = (depth: number, writes: number): NestedSample => {
  if (depth > CONTEXT_MAX_DEPTH) {
    return { depth, ms: SKIPPED, wakes: 0 };
  }

  let chain = buildContextChain(depth);
  let wakes = 0;

  const start = performance.now();
  for (let j = 0; j < writes; j++) {
    const next: ContextLevel[] = [{ ...chain[0], s0: { value: j + 1, tag: 'el' } }];
    wakes++;
    work(wakes);
    for (let i = 1; i < depth; i++) {
      next.push({ ...next[i - 1], [`s${i}`]: chain[i][`s${i}`] });
      wakes++;
      work(wakes);
    }

    chain = next;
  }

  return { depth, ms: performance.now() - start, wakes };
};

// Build cost: every live scope opens a `forwardParentChanges` subscription on its parent. This is the React-mount
// proxy — how long it takes to stand the provider tree up.
const constructLive = (depth: number): NestedSample => {
  const start = performance.now();
  const chain = buildChain(depth);
  const ms = performance.now() - start;
  work(chain.length);

  return { depth, ms, wakes: 0 };
};

// Same depth, disconnected scopes (no parent link). The delta against `constructLive` is exactly what the live
// scope chain costs at mount.
const constructIsolated = (depth: number): NestedSample => {
  const start = performance.now();
  const chain = buildIsolatedChain(depth);
  const ms = performance.now() - start;
  work(chain.length);

  return { depth, ms, wakes: 0 };
};

// A leaf reads a source contributed at the root. `createGetPath` recurses parent→parent until it finds the owner, so
// the first read is O(depth); the result is then memoized and served O(1) until something changes. The leaf
// subscribes first because a reactive read (what `useStore` does) subscribes — that attaches the scope, which is
// what turns its path cache on. This is the read hot path of a deep tree: a leaf component pulling an ancestor source
// across renders with no writes in between.
const leafRead = (depth: number, reads: number): NestedSample => {
  const chain = buildChain(depth);
  const leaf = chain[chain.length - 1];
  leaf.subscribePath(ROOT_LEAF, () => {});
  let acc = 0;

  const start = performance.now();
  for (let i = 0; i < reads; i++) {
    const source = leaf.getPath(ROOT_SOURCE);
    acc += source ? source.value : 0;
  }

  work(acc);

  return { depth, ms: performance.now() - start, wakes: 0 };
};

// A leaf in a disconnected tree reads its own source. With no parent link there is no fall-through — the read is
// O(1) no matter how deep the tree is. The contrast against `leafRead` is the whole cost of the live chain on reads.
const leafReadIsolated = (depth: number, reads: number): NestedSample => {
  const chain = buildIsolatedChain(depth);
  const leaf = chain[chain.length - 1];
  const ownSource: `runtime.sources.${string}` = `runtime.sources.s${depth - 1}`;
  let acc = 0;

  const start = performance.now();
  for (let i = 0; i < reads; i++) {
    const source = leaf.getPath(ownSource);
    acc += source ? source.value : 0;
  }

  work(acc);

  return { depth, ms: performance.now() - start, wakes: 0 };
};

// A source high in the tree changes while a deep leaf is subscribed to it. The change forwards down the chain one
// scope at a time (`forwardParentChanges` re-emits at every level), so a single write fans out O(depth) forwards.
// This is the write hot path — and the one expected to dominate at thousands of providers.
const rootWrite = (depth: number, writes: number): NestedSample => {
  const chain = buildChain(depth);
  const root = chain[0];
  const leaf = chain[chain.length - 1];
  let wakes = 0;
  leaf.subscribePath(ROOT_LEAF, () => {
    wakes++;
    work(wakes);
  });

  const start = performance.now();
  for (let j = 0; j < writes; j++) {
    root.setState(ROOT_LEAF, j + 1);
  }

  return { depth, ms: performance.now() - start, wakes };
};

// The realistic shape: a wide tree where most branches don't watch the changed source. Off the same root we hang
// DEAD_BRANCHES extra chains of the same depth with NO subscribers, plus the one subscribed branch. With lazy
// attachment the unwatched branches never subscribe to the root, so a write still cascades only down the one live
// branch — `rootWriteBushy` should track `rootWrite`, not multiply by the branch count (which is what eager
// attachment, where every scope listens, would cost).
const DEAD_BRANCHES = 8;

const rootWriteBushy = (depth: number, writes: number): NestedSample => {
  const root = createStore<ScopeState>(makeScope(0));

  for (let b = 0; b < DEAD_BRANCHES; b++) {
    let node = root;
    for (let i = 1; i < depth; i++) {
      node = createStore<ScopeState>(makeScope(i), { parent: node });
    }
  }

  let node = root;
  for (let i = 1; i < depth; i++) {
    node = createStore<ScopeState>(makeScope(i), { parent: node });
  }

  let wakes = 0;
  node.subscribePath(ROOT_LEAF, () => {
    wakes++;
    work(wakes);
  });

  const start = performance.now();
  for (let j = 0; j < writes; j++) {
    root.setState(ROOT_LEAF, j + 1);
  }

  return { depth, ms: performance.now() - start, wakes };
};

// Baseline contrast: a leaf writes its own source. Forwarding only flows parent→child, so this never walks the
// chain and should stay flat regardless of depth — isolating the asymmetry that makes `rootWrite` scale.
const leafWrite = (depth: number, writes: number): NestedSample => {
  const chain = buildChain(depth);
  const leaf = chain[chain.length - 1];
  const ownSource: `runtime.sources.${string}` = `runtime.sources.s${depth - 1}`;
  let wakes = 0;
  leaf.subscribePath(ownSource, () => {
    wakes++;
    work(wakes);
  });

  const start = performance.now();
  for (let j = 0; j < writes; j++) {
    leaf.setState(ownSource, { value: j + 1, tag: 'el' });
  }

  return { depth, ms: performance.now() - start, wakes };
};

export type NestedScenario = { id: string; label: string; run: (depth: number) => NestedSample };

const READS = 2000;
const WRITES = 200;

const SCENARIOS: NestedScenario[] = [
  { id: 'mount-ctx', label: `Build nested context overlays (O(depth²), capped at ${CONTEXT_MAX_DEPTH})`, run: constructContext },
  { id: 'mount-live', label: 'Build a live chain (inherit="live" mount proxy)', run: depth => constructLive(depth) },
  { id: 'mount-iso', label: 'Build a disconnected chain (no inherit, mount proxy)', run: depth => constructIsolated(depth) },
  {
    id: 'read-ctx',
    label: `Leaf reads a root source ×${READS} (context, precomputed merge, flat)`,
    run: depth => contextRead(depth, READS)
  },
  {
    id: 'read-live',
    label: `Leaf reads a root source ×${READS} (live, cached fall-through)`,
    run: depth => leafRead(depth, READS)
  },
  {
    id: 'read-iso',
    label: `Leaf reads its own source ×${READS} (disconnected, flat)`,
    run: depth => leafReadIsolated(depth, READS)
  },
  {
    id: 'write-ctx',
    label: `Root source write ×${WRITES} (context, rebuild + wake every level, O(depth²))`,
    run: depth => contextWrite(depth, WRITES)
  },
  {
    id: 'write-root',
    label: `Root source write ×${WRITES}, deep leaf subscribed (live, O(depth) cascade, wakes 1)`,
    run: depth => rootWrite(depth, WRITES)
  },
  {
    id: 'write-bushy',
    label: `Root source write ×${WRITES} with ${DEAD_BRANCHES} unwatched sibling branches (lazy attach prunes them)`,
    run: depth => rootWriteBushy(depth, WRITES)
  },
  {
    id: 'write-leaf',
    label: `Leaf writes its own source ×${WRITES} (no cascade, flat)`,
    run: depth => leafWrite(depth, WRITES)
  }
];

export type NestedRow = { depth: number; results: Record<string, number> };
export type NestedScalingResult = { scenarios: { id: string; label: string }[]; rows: NestedRow[] };

export const DEFAULT_DEPTHS = [50, 100, 250, 500, 1000, 2000];

export function runNestedScaling(depths: number[] = DEFAULT_DEPTHS, reps = 5): NestedScalingResult {
  resetSink();
  for (const scenario of SCENARIOS) {
    scenario.run(50);
  }

  const rows = depths.map(depth => {
    const results: Record<string, number> = {};
    for (const scenario of SCENARIOS) {
      results[scenario.id] = medianBy(() => scenario.run(depth), reps, sample => sample.ms).ms;
    }

    return { depth, results };
  });

  guardSink();

  return { scenarios: SCENARIOS.map(scenario => ({ id: scenario.id, label: scenario.label })), rows };
}
