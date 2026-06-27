import { get } from '@plitzi/plitzi-ui/helpers';

import type { CommitEntry, Element, RenderPhase, TracingTree } from '@plitzi/sdk-shared';
import type { CSSProperties } from 'react';

export type TracingView = 'ranked' | 'flamegraph' | 'hotspots';

// Self = the element's own render work; Total = subtree-inclusive ("as a page"). Both matter, so the views let you
// switch which one drives the bars.
export type DurationMetric = 'self' | 'total';

// What a node represents in a single commit, mirroring React DevTools:
// - `rendered`: its own render function ran this commit — colored by self time.
// - `bubbled`:  it committed only because a descendant re-rendered (it did not re-render itself) — shown gray.
// - `hatched`:  nothing in its subtree rendered this commit — shown striped. Reconstructed from the accumulated tree
//               (it never fires `onRender`, so it isn't in the commit; we know it exists from earlier commits).
export type RenderState = 'rendered' | 'bubbled' | 'hatched';

// One element placed in the full render tree for a commit (every known element, not only the ones that rendered).
export type FlameNode = {
  id: string;
  name: string;
  type: string;
  state: RenderState;
  visible: boolean; // false ⇒ rendered but hidden via `visibility`
  trigger: boolean; // rendered AND no ancestor rendered → a root cause of this commit's cascade
  phase?: RenderPhase; // only when rendered
  actualDuration: number; // subtree-inclusive (0 if it didn't render)
  baseDuration: number; // structural size (drives flamegraph width); stable across commits
  selfDuration: number; // own work (0 if it didn't render)
  depth: number;
  parentId?: string; // nearest ancestor WITHIN this model (undefined for the model's roots) — drives nested layout
  x: number; // left offset as a fraction 0..1
  width: number; // width as a fraction 0..1, proportional to base duration
};

export type FlameModel = {
  nodes: FlameNode[]; // full tree in render order, with layout
  maxDepth: number;
  totalSelf: number; // Σ self over rendered nodes — the denominator for "contribution %"
  renderedCount: number; // how many nodes actually rendered
  triggers: string[]; // ids of the cascade roots (the elements that started this commit)
};

// Per-element aggregate across ALL recorded commits — the session "hotspots" (chatty / expensive elements).
export type HotspotRow = {
  id: string;
  name: string;
  type: string;
  renders: number; // times the element rendered itself
  mounts: number;
  totalSelf: number;
  maxSelf: number;
  avgSelf: number;
  lastSelf: number;
};

// How a whole commit originated, from its elements' React phases. The SSR/hydration pass commits everything as
// `mount` (React's Profiler does NOT fire during the server `renderToString` — only on the client, where hydration
// counts as a mount), so an all-`mount` commit is the hydration baseline; later interactions are `update`. `mixed`
// flags a commit that both mounted new branches and updated existing ones.
export type CommitKind = 'mount' | 'update' | 'mixed';

export const commitKind = (commit: CommitEntry): CommitKind => {
  let mount = 0;
  let update = 0;
  for (const element of commit.elements) {
    if (element.phase === 'mount') {
      mount += 1;
    } else {
      update += 1;
    }
  }

  if (mount > 0 && update === 0) {
    return 'mount';
  }

  if (update > 0 && mount === 0) {
    return 'update';
  }

  return 'mixed';
};

// What a commit represents in the timeline. `ssr` is the synthetic commit #0 standing in for the server render (no
// client Profiler data exists for it). `hydration` is the first real client commit when the app hydrated SSR output —
// an all-`mount` commit; without the `hydrated` signal a pure client mount would falsely read as hydration since both
// are React phase `mount`. `mount` = a later branch mounting; `mixed` = mounts + updates; `update` = ordinary
// re-render.
export type CommitOrigin = 'ssr' | 'hydration' | 'mount' | 'mixed' | 'update';

// The synthetic SSR commit uses id 0; real React commits start at 1.
export const SSR_COMMIT_ID = 0;

export const commitOrigin = (commit: CommitEntry, hydrated: boolean, isFirstReal: boolean): CommitOrigin => {
  if (commit.commitId === SSR_COMMIT_ID) {
    return 'ssr';
  }

  const kind = commitKind(commit);
  if (kind === 'mount') {
    return hydrated && isFirstReal ? 'hydration' : 'mount';
  }

  return kind;
};

export const COMMIT_ORIGIN_LABEL: Record<CommitOrigin, string> = {
  ssr: 'SSR render (server)',
  hydration: 'Hydration (SSR)',
  mount: 'Mount',
  mixed: 'Mount + update',
  update: 'Update'
};

export const COMMIT_ORIGIN_BADGE: Record<CommitOrigin, string> = {
  ssr: 'S',
  hydration: 'H',
  mount: 'M',
  mixed: '±',
  update: '·'
};

// Single source of truth for the commit-badge legend shown under the strip — kept here so the badge glyphs and their
// meanings can't drift apart.
export const COMMIT_ORIGIN_LEGEND = [
  { origin: 'ssr', label: 'SSR' },
  { origin: 'hydration', label: 'Hydration' },
  { origin: 'mount', label: 'Mount' },
  { origin: 'mixed', label: 'Mount+update' },
  { origin: 'update', label: 'Update' }
] as const satisfies ReadonlyArray<{ origin: CommitOrigin; label: string }>;

export const formatMs = (ms: number): string => {
  if (ms < 0.1) {
    return '<0.1ms';
  }

  return `${ms.toFixed(1)}ms`;
};

export const formatPercent = (ratio: number): string => `${Math.round(ratio * 100)}%`;

// Color by ABSOLUTE render time against React's recommended budget, not just relative size — so a render that is the
// biggest in its commit but still cheap stays green, while a genuinely slow one reads red even if it isn't the max.
// Budget reference: 60fps ⇒ ~16ms per frame (React's "fits in a frame" target); 50ms is the Long Tasks threshold.
export const durationColor = (ms: number): string => {
  if (ms >= 50) {
    return 'bg-red-500';
  }

  if (ms >= 16) {
    return 'bg-amber-500';
  }

  if (ms >= 8) {
    return 'bg-emerald-500';
  }

  return 'bg-sky-500';
};

// Single source of truth for the color scale above, rendered by the Legend.
export const DURATION_LEGEND = [
  { color: 'bg-sky-500', label: '<8ms' },
  { color: 'bg-emerald-500', label: '8–16ms' },
  { color: 'bg-amber-500', label: '16–50ms' },
  { color: 'bg-red-500', label: '≥50ms' }
] as const;

export const BUBBLED_COLOR = 'bg-zinc-300 dark:bg-zinc-700';

// Diagonal stripes for "hatched" frames/swatches — nothing in their subtree rendered this commit.
export const HATCH_STYLE: CSSProperties = {
  backgroundImage:
    'repeating-linear-gradient(45deg, rgba(113,113,122,0.22) 0, rgba(113,113,122,0.22) 2px, transparent 2px, transparent 5px)'
};

export const frameColor = (node: FlameNode): string => {
  if (node.state === 'rendered') {
    return durationColor(node.selfDuration);
  }

  if (node.state === 'bubbled') {
    return BUBBLED_COLOR;
  }

  return 'bg-transparent';
};

// Text colour for a flamegraph frame, paired with `frameColor` so the label stays legible on each background: amber
// frames need dark text; the other duration colours are saturated enough for white; bubbled/hatched read as muted.
export const frameTextColor = (node: FlameNode): string => {
  if (node.state === 'bubbled') {
    return 'text-zinc-600 dark:text-zinc-300';
  }

  if (node.state === 'hatched') {
    return 'text-zinc-400 dark:text-zinc-600';
  }

  return durationColor(node.selfDuration) === 'bg-amber-500' ? 'text-stone-900' : 'text-white';
};

export const elementName = (id: string, flat: Record<string, Element> | undefined): string => {
  const element = flat?.[id];
  if (!element) {
    return id;
  }

  const { label, type } = element.definition;

  return label || type || id;
};

export const elementType = (id: string, flat: Record<string, Element> | undefined): string =>
  flat?.[id]?.definition.type ?? 'unknown';

// Same source as the Elements tab: `definition.initialState.visibility`. A rendered element can still be invisible
// (it sets `plitzi-component--hidden` when visibility is false / 'false'), which the views flag with an eye-slash.
export const elementVisible = (id: string, flat: Record<string, Element> | undefined): boolean => {
  // `unknown`: at runtime visibility may be a boolean or the string 'false', which the default's inferred type hides.
  const visibility: unknown = get(flat?.[id], 'definition.initialState.visibility', true);

  return visibility !== false && visibility !== 'false';
};

export const rowDuration = (node: FlameNode, metric: DurationMetric): number =>
  metric === 'self' ? node.selfDuration : node.actualDuration;

// A sliver so hatched nodes with no recorded base duration still get a visible width.
const MIN_SIZE = 0.01;

// Self time above this counts as "the element rendered itself". It absorbs only floating-point summation error — a
// truly bubbled node's self time is exactly 0 because React propagates `actualDuration` additively up the tree.
const SELF_EPS = 1e-6;

type CommitGraph = {
  rendered: Map<string, CommitEntry['elements'][number]>;
  parent: Map<string, string | undefined>;
  children: Map<string, string[]>;
  base: Map<string, number>;
  roots: string[];
  selfOf: (id: string) => number;
};

// Indexes the accumulated tree + a single commit's renders, with self time = `actual − Σ(nearest rendered
// descendants' actual)` (correct across non-rendered intermediates). Shared by the flamegraph model and the session
// hotspots aggregator so both compute self the same way.
const buildCommitGraph = (commit: CommitEntry, tree: TracingTree): CommitGraph => {
  const parent = new Map<string, string | undefined>();
  const base = new Map<string, number>();
  for (const id of Object.keys(tree)) {
    parent.set(id, tree[id].parentId);
    base.set(id, tree[id].baseDuration);
  }

  const rendered = new Map(commit.elements.map(entry => [entry.id, entry]));

  const children = new Map<string, string[]>();
  for (const [id, parentId] of parent) {
    if (parentId !== undefined && parent.has(parentId)) {
      const siblings = children.get(parentId);
      if (siblings) {
        siblings.push(id);
      } else {
        children.set(parentId, [id]);
      }
    }
  }

  // Topmost ancestors of the elements that rendered this commit — the pages/layouts the commit actually touched.
  const roots = new Set<string>();
  for (const id of rendered.keys()) {
    let root = id;
    let parentId = parent.get(id);
    while (parentId !== undefined && parent.has(parentId)) {
      root = parentId;
      parentId = parent.get(parentId);
    }

    roots.add(root);
  }

  const nearestRenderedDescendants = (id: string): string[] => {
    const result: string[] = [];
    const stack = [...(children.get(id) ?? [])];
    while (stack.length > 0) {
      const childId = stack.pop();
      if (childId === undefined) {
        break;
      }

      if (rendered.has(childId)) {
        result.push(childId);
      } else {
        stack.push(...(children.get(childId) ?? []));
      }
    }

    return result;
  };

  const selfOf = (id: string): number => {
    const entry = rendered.get(id);
    if (!entry) {
      return 0;
    }

    const childTotal = nearestRenderedDescendants(id).reduce(
      (sum, childId) => sum + (rendered.get(childId)?.actualDuration ?? 0),
      0
    );

    return Math.max(0, entry.actualDuration - childTotal);
  };

  return { rendered, parent, children, base, roots: [...roots], selfOf };
};

// Builds the FULL render tree for a single commit from the ACCUMULATED tree (every element ever seen). Rendered nodes
// nest under their real ancestors even when those ancestors did not render this commit — so a rendered grandchild
// never detaches to the root and gets its time misattributed to the page. Widths come from base duration (structural,
// stable), not from this commit's time, so the layout doesn't reshuffle between commits — the React DevTools model.
export const buildFlameModel = (
  commit: CommitEntry,
  tree: TracingTree,
  flat: Record<string, Element> | undefined
): FlameModel => {
  const { rendered, children, base, roots, selfOf } = buildCommitGraph(commit, tree);

  const sizeOf = (id: string): number => {
    const b = base.get(id) ?? 0;
    if (b > 0) {
      return b;
    }

    const actual = rendered.get(id)?.actualDuration ?? 0;

    return actual > 0 ? actual : MIN_SIZE;
  };

  const nodes: FlameNode[] = [];
  const triggers: string[] = [];
  let maxDepth = 0;
  let totalSelf = 0;
  let renders = 0;

  const visit = (
    id: string,
    parentId: string | undefined,
    x: number,
    width: number,
    depth: number,
    ancestorRendered: boolean
  ): void => {
    const entry = rendered.get(id);
    const selfDuration = selfOf(id);
    // `rendered` = it did its own work this commit (self time > ~0, exact since React propagates durations additively);
    // `bubbled` = it committed only because a descendant rendered (self time 0); `hatched` = absent from the commit.
    const state: RenderState = entry ? (selfDuration > SELF_EPS ? 'rendered' : 'bubbled') : 'hatched';
    // A trigger is a rendered node with no rendered ancestor — a root cause of the commit's render cascade.
    const trigger = state === 'rendered' && !ancestorRendered;
    if (state === 'rendered') {
      totalSelf += selfDuration;
      renders += 1;
    }

    if (trigger) {
      triggers.push(id);
    }

    maxDepth = Math.max(maxDepth, depth);
    nodes.push({
      id,
      name: elementName(id, flat),
      type: elementType(id, flat),
      state,
      visible: elementVisible(id, flat),
      trigger,
      phase: entry?.phase,
      actualDuration: entry?.actualDuration ?? 0,
      baseDuration: base.get(id) ?? entry?.baseDuration ?? 0,
      selfDuration,
      depth,
      parentId,
      x,
      width
    });

    const kids = children.get(id) ?? [];
    const sizes = kids.map(sizeOf);
    const childrenSum = sizes.reduce((sum, value) => sum + value, 0);
    const span = Math.max(sizeOf(id), childrenSum) || 1;
    let cursor = x;
    kids.forEach((kid, index) => {
      const childWidth = ((sizes[index] || MIN_SIZE) / span) * width;
      visit(kid, id, cursor, childWidth, depth + 1, ancestorRendered || state === 'rendered');
      cursor += childWidth;
    });
  };

  const rootSizes = roots.map(sizeOf);
  const total = rootSizes.reduce((sum, value) => sum + value, 0) || 1;
  let cursor = 0;
  roots.forEach((id, index) => {
    const width = (rootSizes[index] || MIN_SIZE) / total;
    visit(id, undefined, cursor, width, 0, false);
    cursor += width;
  });

  return { nodes, maxDepth, totalSelf, renderedCount: renders, triggers };
};

// Aggregates self time per element across ALL recorded commits — the session hotspots: which elements render the most
// and cost the most. Surfaces chatty/expensive elements (memoization candidates) that a single commit can't reveal.
export const buildHotspots = (
  commits: CommitEntry[],
  tree: TracingTree,
  flat: Record<string, Element> | undefined
): HotspotRow[] => {
  const acc = new Map<
    string,
    { renders: number; mounts: number; totalSelf: number; maxSelf: number; lastSelf: number }
  >();
  for (const commit of commits) {
    const { selfOf } = buildCommitGraph(commit, tree);
    for (const entry of commit.elements) {
      const self = selfOf(entry.id);
      if (self <= SELF_EPS) {
        continue;
      }

      const current = acc.get(entry.id) ?? { renders: 0, mounts: 0, totalSelf: 0, maxSelf: 0, lastSelf: 0 };
      current.renders += 1;
      current.mounts += entry.phase === 'mount' ? 1 : 0;
      current.totalSelf += self;
      current.maxSelf = Math.max(current.maxSelf, self);
      current.lastSelf = self;
      acc.set(entry.id, current);
    }
  }

  return [...acc.entries()].map(([id, value]) => ({
    id,
    name: elementName(id, flat),
    type: elementType(id, flat),
    renders: value.renders,
    mounts: value.mounts,
    totalSelf: value.totalSelf,
    maxSelf: value.maxSelf,
    avgSelf: value.totalSelf / value.renders,
    lastSelf: value.lastSelf
  }));
};
