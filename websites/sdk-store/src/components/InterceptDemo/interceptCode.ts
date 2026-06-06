export const INTERCEPT_CODE = `import { createStore, CANCEL } from '@plitzi/sdk-store';

type State = { quantity: number; code: string; frozen: boolean };

// Interception is just a middleware. beforeChange runs BEFORE the
// write commits — return a value to replace it, CANCEL to block it,
// or undefined to let it through. onChange only observes; this can
// veto. Write your own exactly like a logger.
const guard = api => ({
  beforeChange: ({ path, value }) => {
    // Read-only while frozen: cancel every write but the unfreeze.
    if (api.getState().frozen && path !== 'frozen') return CANCEL;

    // Clamp the quantity into range before it ever hits the store.
    if (path === 'quantity') return Math.max(0, Math.min(10, value));

    // Normalize the code: UPPER, alphanumerics only, max 8 chars.
    if (path === 'code') {
      return value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8);
    }

    return undefined; // everything else passes through unchanged
  }
});

const store = createStore<State>(
  { quantity: 1, code: '', frozen: false },
  { middlewares: [guard] }
);

// setState('quantity', 99) → stored as 10 (clamped)
// setState('code', 'ab-cd!') → stored as 'ABCD'
// setState('quantity', 5) while frozen → blocked, nothing commits`;
