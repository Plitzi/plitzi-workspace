import { StoreProvider } from '@plitzi/nexus/react';

import ExampleCard from '../ExampleCard';
import { ASYNC_CODE } from './asyncCode';
import { ASYNC_INITIAL } from './asyncStore';
import QuotePanel from './components/QuotePanel';

const AsyncDemo = () => (
  <ExampleCard title="Async + Suspense" subtitle="createAsync — fetch lands in the store, UI suspends" code={ASYNC_CODE}>
    <StoreProvider value={ASYNC_INITIAL} autoSync={false}>
      <QuotePanel />
    </StoreProvider>
  </ExampleCard>
);

export default AsyncDemo;
