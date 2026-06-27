import { get } from '@plitzi/plitzi-ui/helpers';

import type { CommitEntry, Element, RenderPhase, TracingTree } from '@plitzi/sdk-shared';
import type { CSSProperties } from 'react';

export type TracingView = 'ranked' | 'flamegraph' | 'hotspots';

// Self = the element's own render work; Total = subtree-inclusive.
export type DurationMetric = 'self' | 'total';

// `rendered` = its own render ran this commit; `bubbled` = committed only because a descendant rendered; `hatched` =
// nothing in its subtree rendered (reconstructed from the accumulated tree, so never present in the commit itself).
type RenderState = 'rendered' | 'bubbled' | 'hatched';

export type FlameNode = {
  id: string;
  name: string;
  type: string;
  state: RenderState;
  visible: boolean;
  trigger: boolean; // rendered AND no ancestor rendered → a root cause of this commit's cascade
  phase?: RenderPhase;
  actualDuration: number; // subtree-inclusive
  baseDuration: number; // structural size, stable across commits → drives width
  selfDuration: number;
  depth: number;
  parentId?: string;
  x: number; // left offset, fraction 0..1
  width: number; // fraction 0..1
};

export type FlameModel = {
  nodes: FlameNode[];
  maxDepth: number;
  totalSelf: number;
  renderedCount: number;
  triggers: string[];
};

export type HotspotRow = {
  id: string;
  name: string;
  type: string;
  renders: number;
  mounts: number;
  totalSelf: number;
  maxSelf: number;
  avgSelf: number;
  lastSelf: number;
};

type CommitKind = 'mount' | 'update' | 'mixed';

const commitKind = (commit: CommitEntry): CommitKind => {
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

export type CommitOrigin = 'ssr' | 'hydration' | 'mount' | 'mixed' | 'update';

export const SSR_COMMIT_ID = 0;

// React's Profiler never fires for the server `renderToString`, so a hydration commit arrives as an all-`mount` pass;
// the `hydrated` signal is what tells it apart from a from-scratch client mount.
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

// Colour by absolute render time against React's frame budget (60fps ≈ 16ms; 50ms is the Long Tasks threshold), so a
// render reads red when it's genuinely slow, not merely the largest in its commit.
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

export const DURATION_LEGEND = [
  { color: 'bg-sky-500', label: '<8ms' },
  { color: 'bg-emerald-500', label: '8–16ms' },
  { color: 'bg-amber-500', label: '16–50ms' },
  { color: 'bg-red-500', label: '≥50ms' }
] as const;

export const BUBBLED_COLOR = 'bg-zinc-300 dark:bg-zinc-700';

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

// Amber frames need dark text for contrast; the other duration colours carry white.
export const frameTextColor = (node: FlameNode): string => {
  if (node.state === 'bubbled') {
    return 'text-zinc-600 dark:text-zinc-300';
  }

  if (node.state === 'hatched') {
    return 'text-zinc-400 dark:text-zinc-600';
  }

  return durationColor(node.selfDuration) === 'bg-amber-500' ? 'text-stone-900' : 'text-white';
};

const elementName = (id: string, flat: Record<string, Element> | undefined): string => {
  const element = flat?.[id];
  if (!element) {
    return id;
  }

  const { label, type } = element.definition;

  return label || type || id;
};

const elementType = (id: string, flat: Record<string, Element> | undefined): string =>
  flat?.[id]?.definition.type ?? 'unknown';

export const elementVisible = (id: string, flat: Record<string, Element> | undefined): boolean => {
  // At runtime visibility may be a boolean or the string 'false', which the default's inferred type hides.
  const visibility: unknown = get(flat?.[id], 'definition.initialState.visibility', true);

  return visibility !== false && visibility !== 'false';
};

export const rowDuration = (node: FlameNode, metric: DurationMetric): number =>
  metric === 'self' ? node.selfDuration : node.actualDuration;

// A sliver so hatched nodes with no recorded base duration still get a visible width.
const MIN_SIZE = 0.01;

// Self time above this counts as a real render; below it is float summation error (React propagates `actualDuration`
// additively, so a truly bubbled node's self time is exactly 0).
const SELF_EPS = 1e-6;

type CommitGraph = {
  rendered: Map<string, CommitEntry['elements'][number]>;
  children: Map<string, string[]>;
  base: Map<string, number>;
  roots: string[];
  selfOf: (id: string) => number;
};

// Indexes the accumulated tree + one commit's renders. Self = `actual − Σ(nearest rendered descendants' actual)`,
// which stays correct across non-rendered intermediates. Shared by the flame model and the hotspots aggregator.
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

  return { rendered, children, base, roots: [...roots], selfOf };
};

// Builds the full render tree for a commit from the accumulated tree: rendered nodes nest under their real ancestors
// even when those didn't render, so a grandchild's time isn't misattributed to the page. Widths come from base
// duration (stable), so the layout doesn't reshuffle between commits — the React DevTools model.
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
    const state: RenderState = entry ? (selfDuration > SELF_EPS ? 'rendered' : 'bubbled') : 'hatched';
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

// Aggregates self time per element across ALL commits — chatty/expensive elements a single commit can't reveal.
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
