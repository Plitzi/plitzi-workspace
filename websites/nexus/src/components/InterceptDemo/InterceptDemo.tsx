import { StoreProvider } from '@plitzi/nexus/react';

import ExampleCard from '../ExampleCard';
import InterceptBody from './components/InterceptBody';
import { INTERCEPT_CODE } from './interceptCode';
import { guard, INTERCEPT_INITIAL } from './interceptStore';

const middlewares = [guard];

const InterceptDemo = () => (
  <ExampleCard
    title="Intercept & transform writes"
    subtitle="a custom beforeChange middleware — clamp, normalize, or CANCEL before commit"
    code={INTERCEPT_CODE}
  >
    <StoreProvider value={INTERCEPT_INITIAL} autoSync={false} middlewares={middlewares}>
      <InterceptBody />
    </StoreProvider>
  </ExampleCard>
);

export default InterceptDemo;
