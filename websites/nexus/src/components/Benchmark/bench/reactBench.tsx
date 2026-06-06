import './setupDom';

import { createContext, useContext, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';

import { createStore, StoreProvider } from '@plitzi/nexus';
import useStore from '@plitzi/nexus/createStore/hooks/useStore';

import { medianBy } from './benchShared';

import type { ReactNode } from 'react';

// Renders the same deeply nested tree three ways and measures mount cost and update-propagation cost, so the real
// gain/loss of replacing nested React context with scoped StoreProviders is measured end to end (mount time, update
// time, and — the decisive number — how many components actually re-render when a shared value changes).
//
//   context   — the pattern being replaced: each level reads the inherited context and re-provides a merged value.
//               A change at the root recreates every level's value identity, so every consumer below re-renders.
//   store     — nested <StoreProvider inherit="live">: each level adds its own source, a leaf reads an ancestor's.
//               A change wakes only the subscribers of that path — the leaf re-renders, the chain does not.
//   isolated  — nested <StoreProvider> with no inherit: disconnected scopes. The leaf reads its own nearest store;
//               an update is purely local. Included to price the bare nested-provider tree with no chain semantics.

type Source = { value: number };
type ScopeState = { runtime: { sources: Record<string, Source> } };
type SourcePath = `runtime.sources.${string}`;

const makeScope = (i: number): ScopeState => ({ runtime: { sources: { [`s${i}`]: { value: 0 } } } });

type Counter = { renders: number };

export type Controller = {
  // Drives one update of the value the leaf depends on, flushed synchronously.
  update: () => void;
  renders: () => number;
  unmount: () => void;
};

export type Contestant = {
  id: string;
  label: string;
  mount: (container: HTMLElement, depth: number) => Controller;
};

// ── context ────────────────────────────────────────────────────────────────────────────────────────────────────

const DataContext = createContext<Record<string, Source>>({});

const ContextLeaf = ({ counter }: { counter: Counter }) => {
  const sources = useContext(DataContext);
  counter.renders++;

  return <span>{sources.s0?.value ?? 0}</span>;
};

const ContextLevel = ({ index, depth, counter }: { index: number; depth: number; counter: Counter }) => {
  const parent = useContext(DataContext);
  counter.renders++;
  const value = useMemo(() => ({ ...parent, [`s${index}`]: { value: 0 } }), [parent, index]);
  const child =
    index >= depth - 1 ? (
      <ContextLeaf counter={counter} />
    ) : (
      <ContextLevel index={index + 1} depth={depth} counter={counter} />
    );

  return <DataContext.Provider value={value}>{child}</DataContext.Provider>;
};

const mountContext = (container: HTMLElement, depth: number): Controller => {
  const counter: Counter = { renders: 0 };
  let setRoot: ((v: number) => void) | null = null;
  let tick = 0;

  const ContextRoot = ({ levels }: { levels: number }) => {
    const [value, setValue] = useState(0);
    setRoot = setValue;
    counter.renders++;
    const sources = useMemo(() => ({ s0: { value } }), [value]);
    const child =
      levels <= 1 ? <ContextLeaf counter={counter} /> : <ContextLevel index={1} depth={levels} counter={counter} />;

    return <DataContext.Provider value={sources}>{child}</DataContext.Provider>;
  };

  const root = createRoot(container);
  flushSync(() => root.render(<ContextRoot levels={depth} />));

  return {
    update: () =>
      flushSync(() => {
        tick++;
        setRoot?.(tick);
      }),
    renders: () => counter.renders,
    unmount: () => flushSync(() => root.unmount())
  };
};

// ── store (live chain) ──────────────────────────────────────────────────────────────────────────────────────────

const StoreLeaf = ({ counter, path }: { counter: Counter; path: SourcePath }) => {
  const [source] = useStore<ScopeState, SourcePath>(path, { defaultValue: undefined });
  counter.renders++;

  return <span>{source?.value ?? 0}</span>;
};

const StoreLevel = ({ index, depth, counter }: { index: number; depth: number; counter: Counter }) => {
  counter.renders++;
  const child =
    index >= depth - 1 ? (
      <StoreLeaf counter={counter} path="runtime.sources.s0" />
    ) : (
      <StoreLevel index={index + 1} depth={depth} counter={counter} />
    );

  return (
    <StoreProvider inherit="live" value={makeScope(index)}>
      {child}
    </StoreProvider>
  );
};

const mountStoreLive = (container: HTMLElement, depth: number): Controller => {
  const counter: Counter = { renders: 0 };
  const rootStore = createStore<ScopeState>({ runtime: { sources: { s0: { value: 0 } } } });
  let tick = 0;

  const StoreRoot = ({ levels }: { levels: number }): ReactNode => {
    const child =
      levels <= 1 ? (
        <StoreLeaf counter={counter} path="runtime.sources.s0" />
      ) : (
        <StoreLevel index={1} depth={levels} counter={counter} />
      );

    return <StoreProvider store={rootStore}>{child}</StoreProvider>;
  };

  const root = createRoot(container);
  flushSync(() => root.render(<StoreRoot levels={depth} />));

  return {
    update: () =>
      flushSync(() => {
        tick++;
        rootStore.setState('runtime.sources.s0.value', tick);
      }),
    renders: () => counter.renders,
    unmount: () => flushSync(() => root.unmount())
  };
};

// ── isolated (disconnected scopes) ──────────────────────────────────────────────────────────────────────────────

const IsolatedLevel = ({
  index,
  depth,
  counter,
  leafStore
}: {
  index: number;
  depth: number;
  counter: Counter;
  leafStore: ReturnType<typeof createStore<ScopeState>>;
}) => {
  counter.renders++;
  if (index >= depth - 1) {
    return (
      <StoreProvider store={leafStore}>
        <StoreLeaf counter={counter} path="runtime.sources.leaf" />
      </StoreProvider>
    );
  }

  return (
    <StoreProvider value={makeScope(index)}>
      <IsolatedLevel index={index + 1} depth={depth} counter={counter} leafStore={leafStore} />
    </StoreProvider>
  );
};

const mountStoreIsolated = (container: HTMLElement, depth: number): Controller => {
  const counter: Counter = { renders: 0 };
  const leafStore = createStore<ScopeState>({ runtime: { sources: { leaf: { value: 0 } } } });
  let tick = 0;

  const IsolatedRoot = ({ levels }: { levels: number }): ReactNode => {
    if (levels <= 1) {
      return (
        <StoreProvider store={leafStore}>
          <StoreLeaf counter={counter} path="runtime.sources.leaf" />
        </StoreProvider>
      );
    }

    return <IsolatedLevel index={1} depth={levels} counter={counter} leafStore={leafStore} />;
  };

  const root = createRoot(container);
  flushSync(() => root.render(<IsolatedRoot levels={depth} />));

  return {
    update: () =>
      flushSync(() => {
        tick++;
        leafStore.setState('runtime.sources.leaf.value', tick);
      }),
    renders: () => counter.renders,
    unmount: () => flushSync(() => root.unmount())
  };
};

export const CONTESTANTS: Contestant[] = [
  { id: 'context', label: 'Nested React context providers (the pattern being replaced)', mount: mountContext },
  { id: 'store', label: 'Nested <StoreProvider inherit="live"> (scoped store chain)', mount: mountStoreLive },
  { id: 'isolated', label: 'Nested <StoreProvider> with no inherit (disconnected scopes)', mount: mountStoreIsolated }
];

export type RenderSample = { ms: number; renders: number };

const withContainer = <T,>(fn: (container: HTMLElement) => T): T => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  try {
    return fn(container);
  } finally {
    container.remove();
  }
};

const measureMount = (contestant: Contestant, depth: number): RenderSample =>
  withContainer(container => {
    const start = performance.now();
    const controller = contestant.mount(container, depth);
    const ms = performance.now() - start;
    const renders = controller.renders();
    controller.unmount();

    return { ms, renders };
  });

const measureUpdate = (contestant: Contestant, depth: number, updates: number): RenderSample =>
  withContainer(container => {
    const controller = contestant.mount(container, depth);
    const before = controller.renders();
    const start = performance.now();
    for (let i = 0; i < updates; i++) {
      controller.update();
    }

    const ms = performance.now() - start;
    const renders = controller.renders() - before;
    controller.unmount();

    return { ms, renders };
  });

export type ReactRow = {
  depth: number;
  mount: Record<string, RenderSample>;
  update: Record<string, RenderSample>;
};

export type ReactBenchResult = {
  contestants: { id: string; label: string }[];
  updates: number;
  rows: ReactRow[];
};

export const DEFAULT_DEPTHS = [25, 50, 100, 200, 400];

export function runReactBench(depths: number[] = DEFAULT_DEPTHS, reps = 5, updates = 50): ReactBenchResult {
  for (const contestant of CONTESTANTS) {
    measureMount(contestant, 10);
    measureUpdate(contestant, 10, 5);
  }

  const rows = depths.map(depth => {
    const mount: Record<string, RenderSample> = {};
    const update: Record<string, RenderSample> = {};
    for (const contestant of CONTESTANTS) {
      mount[contestant.id] = medianBy(() => measureMount(contestant, depth), reps, sample => sample.ms);
      update[contestant.id] = medianBy(() => measureUpdate(contestant, depth, updates), reps, sample => sample.ms);
    }

    return { depth, mount, update };
  });

  return { contestants: CONTESTANTS.map(c => ({ id: c.id, label: c.label })), updates, rows };
}
