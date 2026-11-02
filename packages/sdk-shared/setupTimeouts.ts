import { vi } from 'vitest';

import { testTimeouts } from './testTimeouts';

/**
 * A setup file for a package whose tests need none of `setupTests.ts`'s browser stubs: Vitest's timeouts scaled as the
 * timing budgets are (`testTimeouts`). Named by path in its `setupFiles`.
 */
vi.setConfig(testTimeouts());
