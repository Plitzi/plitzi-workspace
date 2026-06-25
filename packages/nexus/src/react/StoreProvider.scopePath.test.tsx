import { render } from '@testing-library/react';
import { Fragment } from 'react';
import { describe, it, expect } from 'vitest';

import createStore from '../createStore';
import useStoreById from './hooks/useStoreById';
import StoreProvider from './StoreProvider';

import type { StoreApi } from '../types';
import type { ReactNode } from 'react';

type RowState = { state?: { value: string } };

// Position-derived `scopePath`: a stable, collision-free identity per scope instance. Unlike `id` (an authoring name
// that repeats when the same element renders in many places), the path threads the ancestor `segment` chain, so two
// scopes sharing an `id` at different tree positions resolve to distinct paths — the duplicate-id case this solves.
// It rides on the store itself (`store.scopePath`), read through the existing `useStoreById()` — no extra hook/context.

const collect = () => {
  const seen: Record<string, string | undefined> = {};
  const Probe = ({ name }: { name: string }) => {
    seen[name] = useStoreById().scopePath;

    return null;
  };

  return { seen, Probe };
};

describe('createStore: scopePath option', () => {
  it('exposes the scopePath passed at creation', () => {
    const store = createStore<{ a: number }>({ a: 1 }, { scopePath: 'root/a' });

    expect(store.scopePath).toBe('root/a');
  });

  it('leaves scopePath undefined when not provided', () => {
    const store = createStore<{ a: number }>({ a: 1 });

    expect(store.scopePath).toBeUndefined();
  });
});

describe('StoreProvider: scopePath derivation', () => {
  it('a root provider with a segment exposes it as the store scopePath', () => {
    const { seen, Probe } = collect();
    render(
      <StoreProvider segment="root">
        <Probe name="leaf" />
      </StoreProvider>
    );

    expect(seen.leaf).toBe('root');
  });

  it('joins nested segments with "/"', () => {
    const { seen, Probe } = collect();
    render(
      <StoreProvider segment="page">
        <StoreProvider segment="section">
          <StoreProvider segment="button">
            <Probe name="leaf" />
          </StoreProvider>
        </StoreProvider>
      </StoreProvider>
    );

    expect(seen.leaf).toBe('page/section/button');
  });

  it('is transparent for a segment-less provider — it forwards the parent path unchanged', () => {
    const { seen, Probe } = collect();
    render(
      <StoreProvider segment="page">
        <StoreProvider value={{}}>
          <StoreProvider segment="button">
            <Probe name="leaf" />
          </StoreProvider>
        </StoreProvider>
      </StoreProvider>
    );

    expect(seen.leaf).toBe('page/button');
  });

  it('resolves to "" when no ancestor sets a segment', () => {
    const { seen, Probe } = collect();
    render(
      <StoreProvider value={{}}>
        <Probe name="leaf" />
      </StoreProvider>
    );

    expect(seen.leaf).toBe('');
  });

  it('keeps an externally-provided store its own scopePath, and chains children off it', () => {
    const { seen, Probe } = collect();
    const external = createStore<{ a: number }>({ a: 1 }, { scopePath: 'external' });
    render(
      <StoreProvider store={external}>
        <StoreProvider segment="child">
          <Probe name="leaf" />
        </StoreProvider>
      </StoreProvider>
    );

    expect(external.scopePath).toBe('external');
    expect(seen.leaf).toBe('external/child');
  });

  it('gives the same authoring id at two tree positions distinct scopePaths', () => {
    const { seen, Probe } = collect();
    // Both inner providers share id "button" (would collide in the registry) but sit under different segments.
    render(
      <StoreProvider segment="left">
        <StoreProvider id="button" segment="button">
          <Probe name="a" />
        </StoreProvider>
      </StoreProvider>
    );
    render(
      <StoreProvider segment="right">
        <StoreProvider id="button" segment="button">
          <Probe name="b" />
        </StoreProvider>
      </StoreProvider>
    );

    expect(seen.a).toBe('left/button');
    expect(seen.b).toBe('right/button');
    expect(seen.a).not.toBe(seen.b);
  });

  it('writes to a path-private slice stay isolated between same-id sibling scopes', () => {
    const stores: Record<string, StoreApi<RowState>> = {};
    const Capture = ({ name }: { name: string }) => {
      stores[name] = useStoreById<RowState>();

      return null;
    };

    render(
      <StoreProvider segment="root">
        <StoreProvider id="row" segment="row#0" inherit="live" value={{ state: {} as RowState['state'] }}>
          <Capture name="row0" />
        </StoreProvider>
        <StoreProvider id="row" segment="row#1" inherit="live" value={{ state: {} as RowState['state'] }}>
          <Capture name="row1" />
        </StoreProvider>
      </StoreProvider>
    );

    stores.row0.setState('state', { value: 'a' });
    stores.row1.setState('state', { value: 'b' });

    expect(stores.row0.scopePath).toBe('root/row#0');
    expect(stores.row1.scopePath).toBe('root/row#1');
    expect(stores.row0.getPath('state')).toEqual({ value: 'a' });
    expect(stores.row1.getPath('state')).toEqual({ value: 'b' });
  });
});

describe('StoreProvider: scopePath collision-free identity at scale (benchmark)', () => {
  it('yields a distinct path for every instance of a repeated, same-id subtree', () => {
    const N = 200;
    const { seen, Probe } = collect();
    const Row = ({ index }: { index: number }) => (
      // Every row reuses the SAME authoring id; the index folded into the segment keeps the path unique.
      <StoreProvider id="row" segment={`row#${index}`}>
        <Probe name={`row${index}`} />
      </StoreProvider>
    );

    render(
      <StoreProvider segment="list">
        {Array.from({ length: N }, (_, i) => (
          <Fragment key={i}>
            <Row index={i} />
          </Fragment>
        ))}
      </StoreProvider>
    );

    const paths = new Set(Object.values(seen));
    // The registry `id` would collapse all N rows to one identity; scopePath keeps N distinct.
    expect(paths.size).toBe(N);
    expect(seen.row0).toBe('list/row#0');
    expect(seen[`row${N - 1}`]).toBe(`list/row#${N - 1}`);
  });

  it('builds a correct path at deep nesting', () => {
    const D = 64;
    const { seen, Probe } = collect();
    const nest = (depth: number): ReactNode =>
      depth === 0 ? <Probe name="leaf" /> : <StoreProvider segment={`d${D - depth}`}>{nest(depth - 1)}</StoreProvider>;

    render(<Fragment>{nest(D)}</Fragment>);

    const expected = Array.from({ length: D }, (_, i) => `d${i}`).join('/');
    expect(seen.leaf).toBe(expected);
  });
});
