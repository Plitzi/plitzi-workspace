import { afterEach, describe, expect, it, vi } from 'vitest';

import tracingCollector from './tracingCollector';
import tracingStore, { MAX_COMMITS, MAX_TREE_NODES } from './tracingStore';

import type { CommitEntry, TracingTree } from '../../types';

/**
 * What the collector does under a page worth profiling.
 *
 * It runs on the hot path — once per element per render, with a `Profiler` around every one — so the page most worth
 * looking at is the page most able to take the tab down with the panel open. These are the bounds that keep it from
 * doing that; a regression here is not a slow panel, it is a browser that stops answering.
 */

const render = (id: string, parentId: string | undefined, elementId: string, commitTime: number, duration = 0.1) => {
  tracingCollector.linkParent(id, parentId, elementId);
  tracingCollector.onRender(id, 'update', duration, duration, 0, commitTime);
};

/** The collector batches into an animation frame; a macrotask is enough to let one land. */
const flush = async () => {
  await new Promise(resolve => setTimeout(resolve, 30));
};

const tree = (): TracingTree => tracingStore.getState().tree;
const commits = (): CommitEntry[] => tracingStore.getState().commits;

afterEach(() => {
  tracingCollector.stop();
  tracingCollector.clear();
  vi.restoreAllMocks();
});

describe('the collector under a dense page', () => {
  /**
   * The shape that started this: a controlled list whose ninety days each mount a subtree. Every row is its own
   * instance, so the tree it builds is one node per row — which is the point, and also the cost.
   */
  it('records a thousand instances in one commit without falling over', async () => {
    tracingCollector.start();

    const started = performance.now();
    render('page', undefined, 'page', 1);
    for (let row = 0; row < 1000; row += 1) {
      render(`bar-${row}`, 'page', 'bar', 1);
    }

    const elapsed = performance.now() - started;
    await flush();

    expect(elapsed).toBeLessThan(500);
    expect(commits()).toHaveLength(1);
    expect(commits()[0].elements).toHaveLength(1001);
    expect(Object.keys(tree())).toHaveLength(1001);
  });

  /** Every instance of one element answers to that element, or the panel cannot name a single row. */
  it('remembers which element each instance is', async () => {
    tracingCollector.start();
    render('page', undefined, 'page', 2);
    render('bar-0', 'page', 'bar', 2);
    await flush();

    expect(tree()['bar-0'].elementId).toBe('bar');
    expect(commits()[0].elements[1].elementId).toBe('bar');
  });

  /**
   * A long session navigating between dense pages: nothing ever removes a node, because the collector hears about
   * renders and never about teardowns. Left alone this is the leak that takes the tab down eventually.
   */
  it('starts the tree over rather than growing it without bound', async () => {
    tracingCollector.start();
    for (let index = 0; index <= MAX_TREE_NODES; index += 1) {
      render(`n-${index}`, undefined, 'thing', 3);
    }

    await flush();

    expect(Object.keys(tree()).length).toBeLessThanOrEqual(MAX_TREE_NODES);
    // And it keeps working afterwards: the newest instances are the ones that survived.
    expect(tree()[`n-${MAX_TREE_NODES}`]).toBeDefined();
  }, 30_000);

  /**
   * The panel closed costs nothing but the recording itself — no snapshot is published, so nothing re-renders.
   * This is what lets capture stay on from page load, which is the only way the initial mount is ever recorded.
   */
  it('publishes nothing while nobody is looking', async () => {
    const before = tracingStore.getState().commits;
    for (let row = 0; row < 100; row += 1) {
      render(`bar-${row}`, undefined, 'bar', 4);
    }

    await flush();

    expect(tracingStore.getState().commits).toBe(before);

    // And everything captured while it was closed is there the moment it opens.
    tracingCollector.start();

    expect(commits()[0].elements).toHaveLength(100);
  });

  it('drops the oldest commits past the cap', async () => {
    tracingCollector.start();
    for (let commit = 1; commit <= MAX_COMMITS + 20; commit += 1) {
      render('page', undefined, 'page', commit);
    }

    await flush();

    expect(commits()).toHaveLength(MAX_COMMITS);
    // The newest survive: a timeline that dropped the end would be showing history and calling it the present.
    expect(commits().at(-1)?.timestamp).toBe(MAX_COMMITS + 20);
  });
});
