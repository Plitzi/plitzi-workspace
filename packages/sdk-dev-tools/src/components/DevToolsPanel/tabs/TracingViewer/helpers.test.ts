import { describe, expect, it } from 'vitest';

import { buildFlameModel, buildHotspots, buildTreeIndex } from './helpers';

import type { CommitElementRender, CommitEntry, Element, TracingTree } from '@plitzi/sdk-shared';

const element = (id: string, type = 'container'): Element => ({
  id,
  attributes: {},
  definition: { rootId: 'page', label: id, type, styleSelectors: { base: '' } }
});

const render = (id: string, elementId: string, actualDuration: number, parentId?: string): CommitElementRender => ({
  id,
  elementId,
  parentId,
  phase: 'update',
  actualDuration,
  baseDuration: actualDuration
});

const commit = (elements: CommitElementRender[]): CommitEntry => ({
  commitId: 1,
  timestamp: 0,
  duration: elements[0]?.actualDuration ?? 0,
  elementCount: elements.length,
  elements,
  causes: []
});

/**
 * A controlled list: one `row` element, three mounted instances of it, all under the same list.
 *
 * The shape the whole feature exists for — before instances were told apart these three collapsed into one node
 * carrying the last one's timing, so the two renders that made the commit expensive were nowhere in the graph.
 */
const listTree = (): TracingTree => ({
  page: { baseDuration: 10, elementId: 'page' },
  list: { parentId: 'page', baseDuration: 9, elementId: 'list' },
  'row«1»': { parentId: 'list', baseDuration: 3, elementId: 'row' },
  'row«2»': { parentId: 'list', baseDuration: 3, elementId: 'row' },
  'row«3»': { parentId: 'list', baseDuration: 3, elementId: 'row' }
});

const flat = { page: element('page'), list: element('list', 'list'), row: element('row', 'text') };

describe('buildFlameModel / a list whose rows are the same element', () => {
  it('draws one frame per row instead of collapsing them into one', () => {
    const model = buildFlameModel(
      commit([
        render('list', 'list', 9, 'page'),
        render('row«1»', 'row', 3, 'list'),
        render('row«2»', 'row', 3, 'list'),
        render('row«3»', 'row', 3, 'list')
      ]),
      listTree(),
      flat
    );

    const rows = model.nodes.filter(node => node.elementId === 'row');

    expect(rows).toHaveLength(3);
    expect(rows.map(node => node.id)).toEqual(['row«1»', 'row«2»', 'row«3»']);
    // Every instance carries the element's label and type, so the graph reads as the schema does.
    expect(new Set(rows.map(node => node.name))).toEqual(new Set(['row']));
  });

  it('counts the render of every instance, which is what makes the commit expensive', () => {
    const model = buildFlameModel(
      commit([
        render('list', 'list', 9, 'page'),
        render('row«1»', 'row', 3, 'list'),
        render('row«2»', 'row', 3, 'list'),
        render('row«3»', 'row', 3, 'list')
      ]),
      listTree(),
      flat
    );

    expect(model.renderedCount).toBe(3);
  });

  /** Self = own work: the list's 9ms is its three rows' 9ms, so the list itself did nothing but hold them. */
  it('attributes self time to the instance that spent it', () => {
    const model = buildFlameModel(
      commit([
        render('list', 'list', 9, 'page'),
        render('row«1»', 'row', 3, 'list'),
        render('row«2»', 'row', 3, 'list'),
        render('row«3»', 'row', 3, 'list')
      ]),
      listTree(),
      flat
    );

    const byId = new Map(model.nodes.map(node => [node.id, node]));

    expect(byId.get('list')?.selfDuration).toBe(0);
    expect(byId.get('list')?.state).toBe('bubbled');
    expect(byId.get('row«1»')?.selfDuration).toBe(3);
    expect(byId.get('row«1»')?.state).toBe('rendered');
  });

  /** Self stays right when the element between the two did not render at all. */
  it('subtracts across a non-rendered intermediate', () => {
    const tree: TracingTree = {
      page: { baseDuration: 10, elementId: 'page' },
      wrap: { parentId: 'page', baseDuration: 8, elementId: 'wrap' },
      leaf: { parentId: 'wrap', baseDuration: 2, elementId: 'leaf' }
    };
    const model = buildFlameModel(commit([render('page', 'page', 10), render('leaf', 'leaf', 2, 'wrap')]), tree, {
      page: element('page'),
      wrap: element('wrap'),
      leaf: element('leaf')
    });
    const byId = new Map(model.nodes.map(node => [node.id, node]));

    expect(byId.get('page')?.selfDuration).toBe(8);
    expect(byId.get('wrap')?.state).toBe('hatched');
    expect(byId.get('leaf')?.selfDuration).toBe(2);
  });

  /** The frame that started the cascade: rendered with no rendered ancestor above it. */
  it('marks the root cause of the cascade', () => {
    const model = buildFlameModel(
      commit([render('list', 'list', 9, 'page'), render('row«1»', 'row', 3, 'list')]),
      listTree(),
      flat
    );

    expect(model.triggers).toEqual(['list']);
  });
});

describe('buildFlameModel / a tree deep enough to matter', () => {
  /** Recursion here used to mean a stack overflow on a page deep enough to be worth profiling. */
  it('walks a tree ten thousand levels deep without blowing the stack', () => {
    const tree: TracingTree = { n0: { baseDuration: 1, elementId: 'n0' } };
    for (let index = 1; index < 10000; index += 1) {
      tree[`n${index}`] = { parentId: `n${index - 1}`, baseDuration: 1, elementId: `n${index}` };
    }

    const model = buildFlameModel(commit([render('n0', 'n0', 1)]), tree, undefined);

    expect(model.nodes).toHaveLength(10000);
    expect(model.maxDepth).toBe(9999);
  });

  /** Left to right, the order a flamegraph is read in — the iterative walk must not reverse its children. */
  it('keeps siblings in tree order', () => {
    const model = buildFlameModel(commit([render('list', 'list', 9, 'page')]), listTree(), flat);
    const rows = model.nodes.filter(node => node.elementId === 'row');

    expect(rows.map(node => node.id)).toEqual(['row«1»', 'row«2»', 'row«3»']);
    expect(rows[0].x).toBeLessThan(rows[1].x);
    expect(rows[1].x).toBeLessThan(rows[2].x);
  });
});

describe('buildHotspots', () => {
  /**
   * By element, not by instance: a list's rows are one element that rendered many times, and one row per instance
   * with a single render against each would say nothing about which element is expensive.
   */
  it('folds every instance of an element into one row', () => {
    const tree = listTree();
    const commits = [
      commit([render('row«1»', 'row', 3, 'list'), render('row«2»', 'row', 5, 'list')]),
      commit([render('row«1»', 'row', 2, 'list')])
    ];

    const rows = buildHotspots(commits, tree, flat);
    const row = rows.find(entry => entry.id === 'row');

    expect(rows).toHaveLength(1);
    expect(row?.renders).toBe(3);
    expect(row?.totalSelf).toBe(10);
    expect(row?.maxSelf).toBe(5);
  });
});

describe('buildTreeIndex', () => {
  it('links children to the parents it knows, and drops the ones it does not', () => {
    const { children, parent } = buildTreeIndex({
      page: { baseDuration: 1, elementId: 'page' },
      child: { parentId: 'page', baseDuration: 1, elementId: 'child' },
      orphan: { parentId: 'gone', baseDuration: 1, elementId: 'orphan' }
    });

    expect(children.get('page')).toEqual(['child']);
    expect(parent.get('orphan')).toBe('gone');
    expect(children.get('gone')).toBeUndefined();
  });
});
