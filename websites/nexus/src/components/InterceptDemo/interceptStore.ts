import { CANCEL } from '@plitzi/nexus';
import { createStoreHook } from '@plitzi/nexus/react';

import type { StoreMiddleware } from '@plitzi/nexus';

export type InterceptState = { quantity: number; code: string; frozen: boolean };

export const INTERCEPT_INITIAL: InterceptState = { quantity: 1, code: '', frozen: false };

// A custom middleware — interception is just a middleware. `beforeChange` runs before each write commits and may
// transform the value, or return `CANCEL` to block it. Nothing here is built in; you'd write your own the same way.
export const guard: StoreMiddleware<InterceptState> = api => ({
  beforeChange: ({ path, value }) => {
    // While frozen, block every write except the one that unfreezes — a read-only guard, no write commits.
    if (api.getState().frozen && path !== 'frozen') {
      return CANCEL;
    }

    if (path === 'quantity') {
      return Math.max(0, Math.min(10, value as number));
    }

    if (path === 'code') {
      return (value as string)
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase()
        .slice(0, 8);
    }

    return undefined;
  }
});

export const { useStore: useInterceptStore } = createStoreHook<InterceptState>();
