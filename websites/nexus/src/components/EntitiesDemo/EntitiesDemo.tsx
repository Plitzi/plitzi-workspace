import ExampleCard from '../ExampleCard';
import TaskList from './components/TaskList';
import { ENTITIES_CODE } from './entitiesCode';

const EntitiesDemo = () => (
  <ExampleCard
    title="Normalized tasks"
    subtitle="createEntityStore — O(1) per-item updates, per-row reactivity"
    code={ENTITIES_CODE}
  >
    <TaskList />
  </ExampleCard>
);

export default EntitiesDemo;
