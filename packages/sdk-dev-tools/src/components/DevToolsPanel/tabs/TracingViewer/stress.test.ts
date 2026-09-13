import { describe, expect, it } from 'vitest';

import { buildFlameModel, buildHotspots, buildTreeIndex } from './helpers';

import type { CommitElementRender, CommitEntry, TracingTree } from '@plitzi/sdk-shared';

/**
 * The panel against the page that took the browser down.
 *
 * The analytics screen's traffic chart was a controlled list of ninety days, each day a subtree of ten elements with
 * its own permanently-mounted tooltip — a few thousand mounted components, every one of them a `Profiler` and a
 * per-render prop diff with the dev-tools open. Opening the Tracing tab there did not make the panel slow, it stopped
 * the tab answering.
 *
 * Three separate causes, and a bound for each: self time was computed by searching every node's subtree (quadratic in
 * the page), the tree was walked recursively (a stack deep enough to overflow), and the hotspots view rebuilt the
 * whole index once per commit it held. What follows is the shape that broke it, at the size it broke at.
 */

/** A page shaped like the analytics screen: a shell, a chart, and `days` rows of `perRow` elements each. */
const densePage = (days: number, perRow: number) => {
  const tree: TracingTree = {
    page: { baseDuration: 40, elementId: 'page' },
    chart: { parentId: 'page', baseDuration: 38, elementId: 'chart' }
  };
  const elements: CommitElementRender[] = [
    { id: 'page', elementId: 'page', phase: 'update', actualDuration: 40, baseDuration: 40 },
    { id: 'chart', elementId: 'chart', parentId: 'page', phase: 'update', actualDuration: 38, baseDuration: 38 }
  ];

  for (let day = 0; day < days; day += 1) {
    const bar = `bar-${day}`;
    tree[bar] = { parentId: 'chart', baseDuration: 0.4, elementId: 'bar' };
    elements.push({
      id: bar,
      elementId: 'bar',
      parentId: 'chart',
      phase: 'update',
      actualDuration: 0.3,
      baseDuration: 0.4
    });

    for (let part = 0; part < perRow; part += 1) {
      // The tooltip's own nested list: mounted, hidden in CSS, and never looked at.
      tree[`${bar}-p${part}`] = { parentId: bar, baseDuration: 0.02, elementId: `part-${part}` };
    }
  }

  return {
    tree,
    commit: {
      commitId: 1,
      timestamp: 1,
      duration: 40,
      elementCount: elements.length,
      elements,
      causes: []
    } as CommitEntry
  };
};

describe('the tracing panel against a dense page', () => {
  const { tree, commit } = densePage(90, 12);

  it('builds the flamegraph for a thousand-node page in well under a frame budget', () => {
    const started = performance.now();
    const model = buildFlameModel(commit, tree, undefined);
    const elapsed = performance.now() - started;

    expect(model.nodes.length).toBe(Object.keys(tree).length);
    expect(elapsed).toBeLessThan(200);
  });

  /** The rows the chart drew: ninety instances of ONE element, told apart. */
  it('keeps the ninety rows apart instead of collapsing them into one', () => {
    const model = buildFlameModel(commit, tree, undefined);

    expect(model.nodes.filter(node => node.elementId === 'bar')).toHaveLength(90);
    // The shell, the chart and every one of its rows: each did work of its own, so each is a frame that says so.
    expect(model.renderedCount).toBe(92);
  });

  /**
   * Self time used to be `actual − Σ(subtree search for the nearest rendered descendants)`, run once per node. On a
   * page where almost nothing rendered, that search walked nearly the whole page for nearly every node.
   */
  it('attributes self time without searching every subtree', () => {
    const model = buildFlameModel(commit, tree, undefined);
    const byId = new Map(model.nodes.map(node => [node.id, node]));

    // 38 of the page's 40 is the chart's; the chart's 38 is its ninety bars' 27, leaving 11 of its own.
    expect(byId.get('page')?.selfDuration).toBeCloseTo(2, 5);
    expect(byId.get('chart')?.selfDuration).toBeCloseTo(11, 5);
    expect(byId.get('bar-0')?.selfDuration).toBeCloseTo(0.3, 5);
  });

  /** A tree deep enough to overflow the stack the old recursive walk used. */
  it('walks a ten-thousand-deep tree without recursing', () => {
    const deep: TracingTree = { n0: { baseDuration: 1, elementId: 'n0' } };
    for (let index = 1; index < 10_000; index += 1) {
      deep[`n${index}`] = { parentId: `n${index - 1}`, baseDuration: 1, elementId: 'n' };
    }

    const one: CommitEntry = {
      commitId: 1,
      timestamp: 1,
      duration: 1,
      elementCount: 1,
      elements: [{ id: 'n0', elementId: 'n0', phase: 'update', actualDuration: 1, baseDuration: 1 }],
      causes: []
    };

    expect(() => buildFlameModel(one, deep, undefined)).not.toThrow();
    expect(buildFlameModel(one, deep, undefined).maxDepth).toBe(9_999);
  });

  /**
   * Hotspots walks every commit it holds — two hundred of them — and used to rebuild the tree index inside that
   * loop, which made it the size of the page times the length of the timeline.
   */
  it('aggregates a full two-hundred-commit timeline over a dense page', () => {
    const timeline = Array.from({ length: 200 }, (_unused, index) => ({
      ...commit,
      commitId: index,
      timestamp: index
    }));

    const started = performance.now();
    const rows = buildHotspots(timeline, tree, undefined);
    const elapsed = performance.now() - started;

    // By element, not by instance: ninety rows of one `bar` are one row with ninety renders per commit.
    expect(rows.find(row => row.id === 'bar')?.renders).toBe(90 * 200);
    expect(elapsed).toBeLessThan(3000);
  });

  it('indexes the tree once, whatever it is asked afterwards', () => {
    const index = buildTreeIndex(tree);

    expect(index.parent.size).toBe(Object.keys(tree).length);
    expect(index.children.get('chart')).toHaveLength(90);
    expect(buildFlameModel(commit, tree, undefined, index).nodes.length).toBe(Object.keys(tree).length);
  });
});
