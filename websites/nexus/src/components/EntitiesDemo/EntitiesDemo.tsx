import { StoreProvider } from '@plitzi/nexus';

import ExampleCard from '../ExampleCard';
import TaskList from './components/TaskList';
import { ENTITIES_CODE } from './entitiesCode';
import { ENTITIES_INITIAL } from './entitiesStore';

const EntitiesDemo = () => (
  <ExampleCard title="Normalized tasks" subtitle="createEntityAdapter — CRUD updaters + selectors" code={ENTITIES_CODE}>
    <StoreProvider value={ENTITIES_INITIAL}>
      <TaskList />
    </StoreProvider>
  </ExampleCard>
);

export default EntitiesDemo;
