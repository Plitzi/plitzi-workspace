export const ASYNC_CODE = `import { createAsync, useAsyncValue, StoreContext } from '@plitzi/nexus';
import { Suspense, use, useMemo } from 'react';

type Quote = { id: number; text: string; author: string };
type State = { quote: Quote | null };

function QuotePanel() {
  const store = use(StoreContext);

  // The resolved quote is WRITTEN to state.quote — path subs,
  // derived values and persist all see it. { immediate } starts now.
  const resource = useMemo(
    () => createAsync(store, 'quote', fetchQuote, { immediate: [] }),
    [store]
  );

  return (
    <>
      <ErrorBoundary onRetry={() => resource.run()}>
        <Suspense fallback={<Spinner />}>
          <QuoteView resource={resource} />
        </Suspense>
      </ErrorBoundary>
      <button onClick={() => resource.run()}>↻ Fetch another</button>
    </>
  );
}

// Suspends while pending, throws to the boundary on error,
// returns the value (same one in state.quote) when ready.
function QuoteView({ resource }) {
  const quote = useAsyncValue(resource);

  return <blockquote>“{quote.text}” — {quote.author}</blockquote>;
}`;
