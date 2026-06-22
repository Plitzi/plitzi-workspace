import { StoreProvider } from '@plitzi/nexus/react';

import ExampleCard from '../ExampleCard';
import PersistBody from './components/PersistBody';
import { PERSIST_CODE } from './persistCode';
import { persistStore } from './persistStore';

const PersistDemo = () => (
  <ExampleCard title="Persisted state" subtitle="persist middleware — survives a page reload" code={PERSIST_CODE}>
    <StoreProvider store={persistStore}>
      <PersistBody />
    </StoreProvider>
  </ExampleCard>
);

export default PersistDemo;
