import { configureStore } from '@reduxjs/toolkit';

import {
  DEEP_MAP_TARGET,
  makeFlat,
  makeItemMap,
  makeNested,
  makeRowMap,
  makeSumValues,
  REDUX,
  stridedIndices,
  sumValues,
  SUM_TARGET,
  work
} from './shared';

import type { DeepMapState, FlatState, NestedState, Row, Sample, StoreAdapter, SumState } from './shared';
import type { Reducer, Store } from '@reduxjs/toolkit';

// Redux used the realistic fine-grained way (what react-redux's useSelector does): one selector per watched value,
// each re-run on every dispatch and compared to its last result so only changed selectors do work — so a dispatch
// is O(subscribers) in selector evaluations even when one value changed. Reducers do hand-written structural
// sharing (no Immer overhead, the favourable case for Redux).

type SetAction = { type: 'set'; key: string; value: number };
type ScenarioReducer<S> = (state: S | undefined, action: SetAction) => S;

const makeStore = <S>(reducer: ScenarioReducer<S>): Store<S> =>
  // Dev-only serializable/immutable checks are off in production; disable them so the bench is a fair fight.
  configureStore({
    reducer: reducer as Reducer<S>,
    middleware: getDefault => getDefault({ serializableCheck: false, immutableCheck: false })
  });

const subscribeSelector = <S, V>(store: Store<S>, selector: (state: S) => V, onChange: () => void): void => {
  let last = selector(store.getState());
  store.subscribe(() => {
    const next = selector(store.getState());
    if (next !== last) {
      last = next;
      onChange();
    }
  });
};

const flatReducer: Reducer<FlatState, SetAction> = (state = makeFlat(0), action) => {
  if (action.type === 'set') {
    return { ...state, [action.key]: action.value };
  }

  return state;
};

const wide = (keys: number, updates: number): Sample => {
  const store = makeStore<FlatState>((state = makeFlat(keys), action: SetAction) => flatReducer(state, action));
  let wakes = 0;
  for (let i = 0; i < keys; i++) {
    const key = `k${i}`;
    subscribeSelector(
      store,
      state => state[key],
      () => {
        wakes++;
        work(wakes);
      }
    );
  }

  const start = performance.now();
  for (let j = 0; j < updates; j++) {
    store.dispatch({ type: 'set', key: 'k0', value: j + 1 });
  }

  return { name: REDUX, wakes, ms: performance.now() - start };
};

const hot = (subscribers: number, updates: number): Sample => {
  const store = makeStore<FlatState>((state = { k0: 0 }, action: SetAction) => flatReducer(state, action));
  let wakes = 0;
  for (let i = 0; i < subscribers; i++) {
    subscribeSelector(
      store,
      state => state.k0,
      () => {
        wakes++;
        work(wakes);
      }
    );
  }

  const start = performance.now();
  for (let j = 0; j < updates; j++) {
    store.dispatch({ type: 'set', key: 'k0', value: j + 1 });
  }

  return { name: REDUX, wakes, ms: performance.now() - start };
};

const nested = (updates: number): Sample => {
  const store = makeStore<NestedState>((state = makeNested(), action: SetAction) => {
    if (action.type === 'set') {
      const e = state.a.b.c.d.e;

      return { a: { b: { c: { d: { e: { ...e, leaf: action.value } } } } } };
    }

    return state;
  });
  let wakes = 0;
  subscribeSelector(
    store,
    state => state.a.b.c.d.e.leaf,
    () => {
      wakes++;
      work(wakes);
    }
  );

  const start = performance.now();
  for (let j = 0; j < updates; j++) {
    store.dispatch({ type: 'set', key: 'leaf', value: j + 1 });
  }

  return { name: REDUX, wakes, ms: performance.now() - start };
};

const churn = (updates: number): Sample => {
  const store = makeStore<FlatState>((state = makeFlat(10), action: SetAction) => flatReducer(state, action));
  let wakes = 0;
  subscribeSelector(
    store,
    state => state.k0,
    () => {
      wakes++;
      work(wakes);
    }
  );

  const start = performance.now();
  for (let j = 0; j < updates; j++) {
    store.dispatch({ type: 'set', key: 'k0', value: j + 1 });
  }

  return { name: REDUX, wakes, ms: performance.now() - start };
};

const deepMap = (items: number, updates: number): Sample => {
  const store = makeStore<DeepMapState>((state = makeItemMap(items), action: SetAction) => {
    if (action.type === 'set') {
      const prev = state.items[DEEP_MAP_TARGET];

      return { items: { ...state.items, [DEEP_MAP_TARGET]: { ...prev, meta: { ...prev.meta, n: action.value } } } };
    }

    return state;
  });
  let wakes = 0;
  for (let i = 0; i < items; i++) {
    const key = `i${i}`;
    subscribeSelector(
      store,
      state => state.items[key].meta.n,
      () => {
        wakes++;
        work(wakes);
      }
    );
  }

  const start = performance.now();
  for (let j = 0; j < updates; j++) {
    store.dispatch({ type: 'set', key: 'n', value: j + 1 });
  }

  return { name: REDUX, wakes, ms: performance.now() - start };
};

const fanout = (keys: number, rounds: number): Sample => {
  const store = makeStore<FlatState>((state = makeFlat(keys), action: SetAction) => flatReducer(state, action));
  let wakes = 0;
  for (let i = 0; i < keys; i++) {
    const key = `k${i}`;
    subscribeSelector(
      store,
      state => state[key],
      () => {
        wakes++;
        work(wakes);
      }
    );
  }

  const start = performance.now();
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < keys; i++) {
      store.dispatch({ type: 'set', key: `k${i}`, value: r + 1 });
    }
  }

  return { name: REDUX, wakes, ms: performance.now() - start };
};

const derived = (values: number, updates: number): Sample => {
  const store = makeStore<SumState>((state = makeSumValues(values), action: SetAction) => {
    if (action.type === 'set') {
      return { values: { ...state.values, [action.key]: action.value } };
    }

    return state;
  });
  let wakes = 0;
  subscribeSelector(
    store,
    state => sumValues(state.values),
    () => {
      wakes++;
      work(wakes);
    }
  );

  const start = performance.now();
  for (let j = 0; j < updates; j++) {
    store.dispatch({ type: 'set', key: SUM_TARGET, value: j + 1 });
  }

  return { name: REDUX, wakes, ms: performance.now() - start };
};

// Streaming feed — reducer copies the whole map per dispatch; one selector per row re-runs on every dispatch.
const liveFeed = (items: number, updates: number): Sample => {
  const store = makeStore<Record<string, Row>>((state = makeRowMap(items), action: SetAction) => {
    if (action.type === 'set') {
      const prev = state[action.key];

      return { ...state, [action.key]: { ...prev, value: action.value } };
    }

    return state;
  });
  let wakes = 0;
  for (let i = 0; i < items; i++) {
    const key = `r${i}`;
    subscribeSelector(
      store,
      state => state[key].value,
      () => {
        wakes++;
        work(wakes);
      }
    );
  }

  const plan = stridedIndices(items, updates);
  const start = performance.now();
  for (let j = 0; j < updates; j++) {
    store.dispatch({ type: 'set', key: `r${plan[j]}`, value: j + 1 });
  }

  return { name: REDUX, wakes, ms: performance.now() - start };
};

// Selection — central selectedId; every row's selector re-evaluates on each dispatch (O(items)), two flip.
const selection = (items: number, moves: number): Sample => {
  const store = makeStore<{ selectedId: string }>((state = { selectedId: 'r0' }, action: SetAction) => {
    if (action.type === 'set') {
      return { selectedId: action.key };
    }

    return state;
  });
  let wakes = 0;
  for (let i = 0; i < items; i++) {
    const id = `r${i}`;
    subscribeSelector(
      store,
      state => state.selectedId === id,
      () => {
        wakes++;
        work(wakes);
      }
    );
  }

  const start = performance.now();
  for (let m = 1; m <= moves; m++) {
    store.dispatch({ type: 'set', key: `r${m % items}`, value: 0 });
  }

  return { name: REDUX, wakes, ms: performance.now() - start };
};

export const reduxAdapter: StoreAdapter = { wide, hot, nested, churn, deepMap, fanout, derived, liveFeed, selection };
