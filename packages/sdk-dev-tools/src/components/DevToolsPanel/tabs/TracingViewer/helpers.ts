import type { CommitEntry, Element, RenderPhase } from '@plitzi/sdk-shared';

export type TracingView = 'ranked' | 'flamegraph';

// Self = the element's own render work; Total = subtree-inclusive ("as a page"). Both matter, so the views let you
// switch which one drives the bars.
export type DurationMetric = 'self' | 'total';

// A rendered element within a commit, with self time derived from the schema tree.
export type CommitRow = {
  id: string;
  name: string;
  type: string;
  phase: RenderPhase;
  actualDuration: number; // subtree-inclusive
  selfDuration: number; // own work
};

export type FlameNode = CommitRow & {
  depth: number;
  x: number; // left offset as a fraction 0..1 of the focused width
  width: number; // width as a fraction 0..1
};

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

export const rowDuration = (row: CommitRow, metric: DurationMetric): number =>
  metric === 'self' ? row.selfDuration : row.actualDuration;

type CommitTree = {
  rendered: Map<string, CommitEntry['elements'][number]>;
  childrenByParent: Map<string, string[]>;
  roots: string[];
};

// Builds the rendered-element tree of a commit from each render's REAL render-tree parent (captured at render time),
// preserving render order (no sorting). This nests across schemas/rootIds — e.g. a layout under its host page — so
// the flamegraph reads like the actual component tree with a single page root, matching React DevTools.
const buildCommitTree = (commit: CommitEntry): CommitTree => {
  const rendered = new Map(commit.elements.map(entry => [entry.id, entry]));
  const childrenByParent = new Map<string, string[]>();
  const roots: string[] = [];

  for (const { id, parentId } of commit.elements) {
    if (parentId && rendered.has(parentId)) {
      const siblings = childrenByParent.get(parentId);
      if (siblings) {
        siblings.push(id);
      } else {
        childrenByParent.set(parentId, [id]);
      }
    } else {
      roots.push(id);
    }
  }

  return { rendered, childrenByParent, roots };
};

const selfOf = (id: string, tree: CommitTree): number => {
  const own = tree.rendered.get(id)?.actualDuration ?? 0;
  const children = tree.childrenByParent.get(id) ?? [];
  const childTotal = children.reduce((sum, childId) => sum + (tree.rendered.get(childId)?.actualDuration ?? 0), 0);

  return Math.max(0, own - childTotal);
};

// One row per rendered element with its derived self time — the data behind the Ranked view.
export const commitRows = (commit: CommitEntry, flat: Record<string, Element> | undefined): CommitRow[] => {
  const tree = buildCommitTree(commit);

  return commit.elements.map(entry => ({
    id: entry.id,
    name: elementName(entry.id, flat),
    type: elementType(entry.id, flat),
    phase: entry.phase,
    actualDuration: entry.actualDuration,
    selfDuration: selfOf(entry.id, tree)
  }));
};

// Classic icicle layout for one commit, in tree order: a node's width is its subtree-INCLUSIVE time relative to the
// whole commit, children packed left-to-right inside that width. The gap a parent's children leave uncovered is its
// self time — so the cascade is visible. The layout is always the FULL tree so it never reshuffles; focusing a node
// is a highlight (see the Flamegraph), not a relayout.
export const buildFlameLayout = (
  commit: CommitEntry,
  flat: Record<string, Element> | undefined
): { nodes: FlameNode[]; maxDepth: number } => {
  const tree = buildCommitTree(commit);
  const inclusiveOf = (id: string): number => tree.rendered.get(id)?.actualDuration ?? 0;

  const nodes: FlameNode[] = [];
  let maxDepth = 0;

  const visit = (id: string, x: number, width: number, depth: number): void => {
    const entry = tree.rendered.get(id);
    if (!entry) {
      return;
    }

    maxDepth = Math.max(maxDepth, depth);
    nodes.push({
      id,
      name: elementName(id, flat),
      type: elementType(id, flat),
      phase: entry.phase,
      actualDuration: entry.actualDuration,
      selfDuration: selfOf(id, tree),
      depth,
      x,
      width
    });

    const children = tree.childrenByParent.get(id) ?? [];
    const span = entry.actualDuration || 1;
    let cursor = x;
    for (const childId of children) {
      const childWidth = (inclusiveOf(childId) / span) * width;
      visit(childId, cursor, childWidth, depth + 1);
      cursor += childWidth;
    }
  };

  const total = tree.roots.reduce((sum, id) => sum + inclusiveOf(id), 0) || 1;
  let cursor = 0;
  for (const id of tree.roots) {
    const width = inclusiveOf(id) / total;
    visit(id, cursor, width, 0);
    cursor += width;
  }

  return { nodes, maxDepth };
};
