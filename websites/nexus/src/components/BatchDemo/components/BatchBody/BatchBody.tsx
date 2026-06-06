import { use, useCallback, useEffect, useRef, useState } from 'react';

import { StoreContext } from '@plitzi/nexus';

import { PEOPLE, useBatchStore } from '../../batchStore';

import type { BatchState } from '../../batchStore';
import type { StoreApi } from '@plitzi/nexus';

const FIELDS = ['firstName', 'lastName', 'age', 'city'] as const;

const BatchBody = () => {
  const store = use(StoreContext) as StoreApi<BatchState>;
  const [[firstName, lastName, age, city]] = useBatchStore(FIELDS);
  const wakeRef = useRef(0);
  const personRef = useRef(0);
  const [lastWakes, setLastWakes] = useState<number | null>(null);
  const [lastMode, setLastMode] = useState<'separate' | 'batch' | null>(null);

  useEffect(
    () =>
      store.subscribe(() => {
        wakeRef.current += 1;
      }),
    [store]
  );

  const writeNextPerson = useCallback(() => {
    const person = PEOPLE[personRef.current++ % PEOPLE.length];
    store.setState('firstName', person.firstName);
    store.setState('lastName', person.lastName);
    store.setState('age', person.age);
    store.setState('city', person.city);
  }, [store]);

  const applySeparate = useCallback(() => {
    const before = wakeRef.current;
    writeNextPerson();
    setLastWakes(wakeRef.current - before);
    setLastMode('separate');
  }, [writeNextPerson]);

  const applyBatch = useCallback(() => {
    const before = wakeRef.current;
    store.batch(writeNextPerson);
    setLastWakes(wakeRef.current - before);
    setLastMode('batch');
  }, [store, writeNextPerson]);

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-2 font-mono text-xs">
        <div className="rounded-md border border-ink-800 bg-ink-900/60 px-3 py-2">
          <dt className="text-zinc-500">firstName</dt>
          <dd className="text-white">{firstName}</dd>
        </div>
        <div className="rounded-md border border-ink-800 bg-ink-900/60 px-3 py-2">
          <dt className="text-zinc-500">lastName</dt>
          <dd className="text-white">{lastName}</dd>
        </div>
        <div className="rounded-md border border-ink-800 bg-ink-900/60 px-3 py-2">
          <dt className="text-zinc-500">age</dt>
          <dd className="text-white">{age}</dd>
        </div>
        <div className="rounded-md border border-ink-800 bg-ink-900/60 px-3 py-2">
          <dt className="text-zinc-500">city</dt>
          <dd className="text-white">{city}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={applySeparate}
          className="rounded-md border border-ink-600 bg-ink-800 px-3 py-1.5 text-sm text-zinc-300 transition hover:border-brand-500 hover:text-white"
        >
          4 separate writes
        </button>
        <button
          onClick={applyBatch}
          className="rounded-md border border-brand-500/60 bg-brand-500/10 px-3 py-1.5 text-sm text-brand-200 transition hover:border-brand-400 hover:text-white"
        >
          store.batch(…)
        </button>
      </div>

      <div className="rounded-lg border border-ink-800 bg-ink-900/60 px-4 py-3">
        {lastWakes === null ? (
          <p className="text-xs text-zinc-500">Click a button — both change all four fields.</p>
        ) : (
          <p className="text-sm">
            <span className="text-zinc-500">Last action ({lastMode}) woke the store </span>
            <span className={lastMode === 'batch' ? 'font-bold text-brand-300' : 'font-bold text-white'}>
              {lastWakes}×
            </span>
          </p>
        )}
        <p className="mt-1.5 text-xs leading-relaxed text-zinc-600">
          React coalesces the <em>renders</em> either way — what <code className="text-brand-300">batch</code> coalesces
          is the store’s own wake pass: derived values, middleware and non-React subscribers fire once instead of four
          times.
        </p>
      </div>
    </div>
  );
};

export default BatchBody;
