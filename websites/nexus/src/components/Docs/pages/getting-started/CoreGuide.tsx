import CodeBlock from '../../../CodeBlock';

const CoreGuide = () => (
  <>
    <h2>Core — any framework (or none)</h2>
    <p>
      The root <code>@plitzi/nexus</code> is the framework-agnostic store. It has no UI dependency, so it works in
      Node, a worker, or any framework via <code>subscribe</code> / <code>getState</code>.
    </p>
    <CodeBlock language="bash" code={`npm install @plitzi/nexus`} />

    <CodeBlock
      code={`import { createStore } from '@plitzi/nexus';

type AppState = { count: number; user: { name: string } };

const store = createStore<AppState>({ count: 0, user: { name: 'Ada' } });

store.get('user.name');               // 'Ada' — one path, no full merge
store.set('count', n => n + 1);       // typed write (updater form)
const off = store.watch('count', () => console.log(store.get('count')));
// ...later: off();`}
    />
    <p>
      Everything else — middlewares (<code>loggerMiddleware</code>, <code>persistMiddleware</code>,{' '}
      <code>historyMiddleware</code>), <code>createEntityStore</code>, <code>createDerived</code>,{' '}
      <code>createAsync</code> — is exported from this same root entry and is React-free.
    </p>
  </>
);

export default CoreGuide;
