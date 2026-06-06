import { StoreProvider } from '@plitzi/nexus';

import ExampleCard from '../ExampleCard';
import TodoBody from './components/TodoBody';
import { TODO_CODE } from './todoCode';
import { TODO_INITIAL } from './todoStore';

const TodoDemo = () => (
  <ExampleCard
    title="To-do list"
    subtitle="Array state, add / toggle / delete, filter + derived count"
    code={TODO_CODE}
  >
    <StoreProvider value={TODO_INITIAL}>
      <TodoBody />
    </StoreProvider>
  </ExampleCard>
);

export default TodoDemo;
