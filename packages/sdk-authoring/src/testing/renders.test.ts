import { afterEach, describe, expect, it, vi } from 'vitest';

import { inspectRenders, summariseRenders } from './renders';

import type { RenderEvaluator } from './renders';
import type { TracingReader } from '@plitzi/sdk-shared/store/tracing';

/** A page that runs what it is handed right here, over a `window` holding `reader` — or none. */
const pageWith = (reader: Partial<TracingReader> | undefined): RenderEvaluator => ({
  evaluate: <R>(fn: (since: number) => R, since: number) => {
    vi.stubGlobal('window', reader ? { plitziTracing: reader } : {});

    return Promise.resolve(fn(since));
  }
});

const render = (elementId: string, changed?: string[]) => ({
  id: `${elementId}:r1`,
  elementId,
  phase: 'update' as const,
  actualDuration: 0,
  baseDuration: 0,
  ...(changed ? { changedProps: changed.map(key => ({ key, prev: '', next: '' })) } : {})
});

const commit = (commitId: number, elements: ReturnType<typeof render>[], causes: string[] = []) => ({
  commitId,
  timestamp: commitId,
  duration: 0,
  elementCount: elements.length,
  elements,
  causes: causes.map(path => ({ path, preview: '' }))
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('summariseRenders', () => {
  it('counts each element by its own renders, not the ancestors that report the commit too', () => {
    const report = summariseRenders([
      commit(1, [render('page'), render('toolbar', ['attributes']), render('button', [])], ['runtime.state.tool']),
      commit(2, [render('toolbar', ['elementState'])])
    ]);

    expect(report).toEqual({
      commits: 2,
      total: 3,
      elements: [
        { id: 'toolbar', renders: 2, changed: ['attributes', 'elementState'] },
        { id: 'button', renders: 1, changed: [] }
      ],
      causes: ['runtime.state.tool'],
      problems: []
    });
  });

  it('says how far over the budget it went, and which elements rendered most', () => {
    const report = summariseRenders([commit(1, [render('a', ['attributes']), render('b', [])])], 1);

    expect(report.problems).toEqual([
      '2 element renders, more than the 1 allowed — most: a ×1 (attributes); b ×1 (nothing of its own)'
    ]);
  });
});

describe('inspectRenders', () => {
  it('reads the commits after the mark it took before acting', async () => {
    const commitsSince = vi.fn(() => [commit(8, [render('counter', ['attributes'])])]);
    const act = vi.fn(() => Promise.resolve());
    const report = await inspectRenders(pageWith({ lastCommitId: () => 7, commitsSince }), act, { settle: 0 });

    expect(act).toHaveBeenCalledOnce();
    expect(commitsSince).toHaveBeenCalledWith(7);
    expect(report.elements).toEqual([{ id: 'counter', renders: 1, changed: ['attributes'] }]);
  });

  it('says how to turn tracing on when the page has none', async () => {
    await expect(inspectRenders(pageWith(undefined), () => Promise.resolve(), { settle: 0 })).rejects.toThrow(
      /only under `debugMode`/
    );
  });
});
