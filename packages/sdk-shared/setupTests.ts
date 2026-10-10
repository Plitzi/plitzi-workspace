import { vi } from 'vitest';
import createFetchMock from 'vitest-fetch-mock';

(globalThis as Record<string, unknown>).PERF_MULTIPLIER = Number(
  process.env.PERF_MULTIPLIER ?? (process.env.TURBO_RUN ? 5 : 1)
);

//  set globalThis.fetch and globalThis.fetchMock
const fetchMocker = createFetchMock(vi);
fetchMocker.enableMocks();

// A class, as the browser's is: what calls it calls it with `new`, which an arrow function refuses.
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  }
);

// Only where there is a window: a file that opts into `@vitest-environment node` (one running a bundler) has none.
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: unknown) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  });
}
