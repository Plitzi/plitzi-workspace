export const BATCH_CODE = `import { createStoreHook, StoreContext } from '@plitzi/nexus';
import { use, useRef } from 'react';

type State = { firstName: string; lastName: string; age: number; city: string };
const { useStore } = createStoreHook<State>();

function BatchDemo() {
  const store = use(StoreContext);
  const [[firstName, lastName, age, city]] =
    useStore(['firstName', 'lastName', 'age', 'city']);

  const writeAll = () => {
    store.setState('firstName', next.firstName);
    store.setState('lastName', next.lastName);
    store.setState('age', next.age);
    store.setState('city', next.city);
  };

  // 4 writes → 4 store wake passes
  const applySeparate = () => writeAll();

  // 4 writes → ONE wake pass; subscribers/derived/middleware fire once
  const applyBatch = () => store.batch(writeAll);

  return (
    <>
      <button onClick={applySeparate}>4 separate writes</button>
      <button onClick={applyBatch}>store.batch(…)</button>
    </>
  );
}`;
