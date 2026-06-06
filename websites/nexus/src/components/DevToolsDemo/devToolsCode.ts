export const DEVTOOLS_CODE = `import { createStore, reduxDevToolsMiddleware } from '@plitzi/nexus';

type State = { count: number; user: { name: string } };

// One middleware mirrors the store to the Redux DevTools browser
// extension: every committed change is sent as an action (labelled
// by the path that changed), and time-travel from the DevTools UI
// (jump / rollback) is written back into the store. A no-op when the
// extension isn't installed — safe to leave wired in for production.
const store = createStore<State>(
  { count: 0, user: { name: 'Ada' } },
  { middlewares: [reduxDevToolsMiddleware({ name: 'my-app' })] }
);

store.setState('count', 1);        // → action "count"      in DevTools
store.setState('user.name', 'Bob'); // → action "user.name"  in DevTools

// Drag the DevTools slider to a past action and the store's
// subscribers re-render at that state — real time-travel, because
// the middleware applies the jumped state via setState.`;
