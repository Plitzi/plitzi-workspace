import { Suspense, use, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { createAsync, StoreContext } from '@plitzi/sdk-store';

import { fetchQuote } from '../../asyncStore';
import AsyncErrorBoundary from '../AsyncErrorBoundary';
import QuoteView from '../QuoteView';

import type { AsyncDemoState } from '../../asyncStore';
import type { StoreApi } from '@plitzi/sdk-store';

const Spinner = () => (
  <div className="flex items-center gap-2 text-sm text-zinc-500">
    <span className="h-3 w-3 animate-spin rounded-full border-2 border-ink-600 border-t-brand-400" />
    Fetching…
  </div>
);

const QuotePanel = () => {
  const store = use(StoreContext) as StoreApi<AsyncDemoState>;
  const failRef = useRef(false);
  const [fail, setFail] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const resource = useMemo(
    // The resolved quote is written to state.quote; the fetcher reads the live `fail` toggle.
    () => createAsync<AsyncDemoState, 'quote', []>(store, 'quote', () => fetchQuote(failRef.current), { immediate: [] }),
    [store]
  );

  useEffect(() => () => resource.destroy(), [resource]);

  const reload = useCallback(() => {
    setAttempt(value => value + 1);
    resource.run().catch(() => undefined);
  }, [resource]);

  const toggleFail = useCallback(() => {
    setFail(value => {
      failRef.current = !value;

      return !value;
    });
  }, []);

  return (
    <div className="space-y-4">
      <div className="min-h-19 rounded-lg border border-ink-800 bg-ink-900/60 p-4">
        <AsyncErrorBoundary resetKey={attempt} onRetry={reload}>
          <Suspense fallback={<Spinner />}>
            <QuoteView resource={resource} />
          </Suspense>
        </AsyncErrorBoundary>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={reload}
          className="rounded-md border border-brand-500/60 bg-brand-500/10 px-3 py-1.5 text-sm text-brand-200 transition hover:border-brand-400 hover:text-white"
        >
          ↻ Fetch another
        </button>
        <label className="flex items-center gap-2 text-xs text-zinc-400">
          <input type="checkbox" checked={fail} onChange={toggleFail} className="accent-brand-500" />
          simulate error
        </label>
      </div>

      <p className="text-xs leading-relaxed text-zinc-600">
        The resolved quote is written to <code className="text-brand-300">state.quote</code> — so any{' '}
        <code className="text-brand-300">useStore('quote')</code>, derived value or persist middleware sees it too.{' '}
        <code className="text-brand-300">useAsyncValue</code> suspends while in flight and throws to the boundary on
        failure.
      </p>
    </div>
  );
};

export default QuotePanel;
