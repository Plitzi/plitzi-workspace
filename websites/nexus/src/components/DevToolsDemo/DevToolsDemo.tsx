import { reduxDevToolsMiddleware } from '@plitzi/nexus';
import { StoreProvider } from '@plitzi/nexus/react';

import ExampleCard from '../ExampleCard';
import DevToolsBody from './components/DevToolsBody';
import { DEVTOOLS_CODE } from './devToolsCode';
import { DEVTOOLS_INITIAL, DEVTOOLS_NAME } from './devToolsStore';

import type { DevToolsState } from './devToolsStore';

const middlewares = [reduxDevToolsMiddleware<DevToolsState>({ name: DEVTOOLS_NAME })];

const DevToolsDemo = () => (
  <ExampleCard
    title="Redux DevTools"
    subtitle="one middleware → actions, inspector, and time-travel in the Redux DevTools extension"
    code={DEVTOOLS_CODE}
  >
    <StoreProvider<DevToolsState> value={DEVTOOLS_INITIAL} autoSync={false} middlewares={middlewares}>
      <DevToolsBody />
    </StoreProvider>
  </ExampleCard>
);

export default DevToolsDemo;
