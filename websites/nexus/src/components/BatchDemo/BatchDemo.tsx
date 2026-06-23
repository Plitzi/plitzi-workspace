import { StoreProvider } from '@plitzi/nexus/react';

import ExampleCard from '../ExampleCard';
import { BATCH_CODE } from './batchCode';
import { BATCH_INITIAL } from './batchStore';
import BatchBody from './components/BatchBody';

const BatchDemo = () => (
  <ExampleCard title="Batched updates" subtitle="store.batch — many writes, one wake pass" code={BATCH_CODE}>
    <StoreProvider value={BATCH_INITIAL} autoSync={false}>
      <BatchBody />
    </StoreProvider>
  </ExampleCard>
);

export default BatchDemo;
