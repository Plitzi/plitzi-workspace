import { get } from '@plitzi/plitzi-ui/helpers';

import type { CommitEntry, Element, PropChange, RenderPhase, TracingTree } from '@plitzi/sdk-shared';
import type { CSSProperties } from 'react';

export type TracingView = 'ranked' | 'flamegraph' | 'hotspots';

// Self = the element's own render work; Total = subtree-inclusive.
export type DurationMetric = 'self' | 'total';

// `rendered` = its own render ran this commit; `bubbled` = committed only because a descendant rendered; `hatched` =
// nothing in its subtree rendered (reconstructed from the accumulated tree, so never present in the commit itself).
type RenderState = 'rendered' | 'bubbled' | 'hatched';

export type FlameNode = {
  /** This INSTANCE — a list's rows are one node each. See `CommitElementRender.id`. */
  id: string;
  /** Which element the instance is: the label, the schema lookup, and what gets outlined on the page. */
  elementId: string;
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
  changedProps?: PropChange[]; // inputs that changed vs this element's previous render (undefined if not captured)
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
  /** The ELEMENT, not an instance: a list's hundred rows are one row here, with a hundred renders against it. */
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

/**
 * The accumulated tree, indexed once.
 *
 * Separate from any single commit because none of it depends on one: the parent links, the sizes and the child lists
 * are facts about the tree. Rebuilding them per commit is what made the hotspots view — which walks every commit it
 * has — quadratic in the size of the page.
 */
export type TreeIndex = {
  parent: Map<string, string | undefined>;
  base: Map<string, number>;
  children: Map<string, string[]>;
  elementOf: Map<string, string>;
};

export const buildTreeIndex = (tree: TracingTree): TreeIndex => {
  const parent = new Map<string, string | undefined>();
  const base = new Map<string, number>();
  const elementOf = new Map<string, string>();
  for (const id of Object.keys(tree)) {
    parent.set(id, tree[id].parentId);
    base.set(id, tree[id].baseDuration);
    elementOf.set(id, tree[id].elementId);
  }

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

  return { parent, base, children, elementOf };
};

type CommitGraph = {
  rendered: Map<string, CommitEntry['elements'][number]>;
  self: Map<string, number>;
  roots: string[];
};

/**
 * One commit's renders, against the indexed tree.
 *
 * Self = `actual − Σ(nearest rendered descendants' actual)`, which stays correct across non-rendered intermediates.
 * Computed by walking UP from each rendered node to its nearest rendered ancestor and subtracting there — one pass
 * over the renders, rather than a downward search of every node's subtree for each node. The downward version was
 * quadratic in the page: on a dense page it was the panel hanging, not the panel drawing.
 */
const buildCommitGraph = (commit: CommitEntry, index: TreeIndex): CommitGraph => {
  const { parent } = index;
  const rendered = new Map(commit.elements.map(entry => [entry.id, entry]));

  const self = new Map<string, number>();
  for (const entry of commit.elements) {
    self.set(entry.id, entry.actualDuration);
  }

  for (const entry of commit.elements) {
    let ancestor = parent.get(entry.id);
    while (ancestor !== undefined && !rendered.has(ancestor)) {
      ancestor = parent.get(ancestor);
    }

    if (ancestor !== undefined) {
      self.set(ancestor, (self.get(ancestor) ?? 0) - entry.actualDuration);
    }
  }

  for (const [id, value] of self) {
    if (value < 0) {
      self.set(id, 0);
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

  return { rendered, self, roots: [...roots] };
};

// Builds the full render tree for a commit from the accumulated tree: rendered nodes nest under their real ancestors
// even when those didn't render, so a grandchild's time isn't misattributed to the page. Widths come from base
// duration (stable), so the layout doesn't reshuffle between commits — the React DevTools model.
export const buildFlameModel = (
  commit: CommitEntry,
  tree: TracingTree,
  flat: Record<string, Element> | undefined,
  index: TreeIndex = buildTreeIndex(tree)
): FlameModel => {
  const { children, base, elementOf } = index;
  const { rendered, self, roots } = buildCommitGraph(commit, index);

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

  type Frame = {
    id: string;
    parentId: string | undefined;
    x: number;
    width: number;
    depth: number;
    ancestorRendered: boolean;
  };

  /**
   * Iterative, not recursive.
   *
   * A page deep enough to be worth profiling is a page deep enough to overflow the stack while profiling it: every
   * element is a node here, and with one node per list ROW a long list nests as far as the schema does. An explicit
   * stack costs nothing and cannot blow up.
   */
  const stack: Frame[] = [];
  const rootSizes = roots.map(sizeOf);
  const total = rootSizes.reduce((sum, value) => sum + value, 0) || 1;
  let cursor = 0;
  roots.forEach((id, position) => {
    const width = (rootSizes[position] || MIN_SIZE) / total;
    stack.push({ id, parentId: undefined, x: cursor, width, depth: 0, ancestorRendered: false });
    cursor += width;
  });
  stack.reverse();

  while (stack.length > 0) {
    const frame = stack.pop();
    if (frame === undefined) {
      break;
    }

    const { id, parentId, x, width, depth, ancestorRendered } = frame;
    const entry = rendered.get(id);
    const selfDuration = self.get(id) ?? 0;
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
    const elementId = elementOf.get(id) ?? entry?.elementId ?? id;
    nodes.push({
      id,
      elementId,
      name: elementName(elementId, flat),
      type: elementType(elementId, flat),
      state,
      visible: elementVisible(elementId, flat),
      trigger,
      phase: entry?.phase,
      actualDuration: entry?.actualDuration ?? 0,
      baseDuration: base.get(id) ?? entry?.baseDuration ?? 0,
      selfDuration,
      depth,
      parentId,
      changedProps: entry?.changedProps,
      x,
      width
    });

    const kids = children.get(id) ?? [];
    if (kids.length === 0) {
      continue;
    }

    const sizes = kids.map(sizeOf);
    const childrenSum = sizes.reduce((sum, value) => sum + value, 0);
    const span = Math.max(sizeOf(id), childrenSum) || 1;
    let childCursor = x;
    const pushed: Frame[] = [];
    kids.forEach((kid, position) => {
      const childWidth = ((sizes[position] || MIN_SIZE) / span) * width;
      pushed.push({
        id: kid,
        parentId: id,
        x: childCursor,
        width: childWidth,
        depth: depth + 1,
        ancestorRendered: ancestorRendered || state === 'rendered'
      });
      childCursor += childWidth;
    });
    // Reversed on the way in, so popping walks the children left to right — the order a flamegraph is read in.
    for (let position = pushed.length - 1; position >= 0; position -= 1) {
      stack.push(pushed[position]);
    }
  }

  return { nodes, maxDepth, totalSelf, renderedCount: renders, triggers };
};

/**
 * Aggregates self time across ALL commits — chatty/expensive elements a single commit can't reveal.
 *
 * By ELEMENT and not by instance, which is the whole point of the view: a list's hundred rows are one element that
 * rendered a hundred times, and a hundred rows of one render each would say nothing. The flamegraph is where the
 * instances are told apart.
 */
export const buildHotspots = (
  commits: CommitEntry[],
  tree: TracingTree,
  flat: Record<string, Element> | undefined
): HotspotRow[] => {
  const index = buildTreeIndex(tree);
  const acc = new Map<
    string,
    { renders: number; mounts: number; totalSelf: number; maxSelf: number; lastSelf: number }
  >();
  for (const commit of commits) {
    const { self } = buildCommitGraph(commit, index);
    for (const entry of commit.elements) {
      const value = self.get(entry.id) ?? 0;
      if (value <= SELF_EPS) {
        continue;
      }

      const elementId = index.elementOf.get(entry.id) ?? entry.elementId;
      const current = acc.get(elementId) ?? { renders: 0, mounts: 0, totalSelf: 0, maxSelf: 0, lastSelf: 0 };
      current.renders += 1;
      current.mounts += entry.phase === 'mount' ? 1 : 0;
      current.totalSelf += value;
      current.maxSelf = Math.max(current.maxSelf, value);
      current.lastSelf = value;
      acc.set(elementId, current);
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
