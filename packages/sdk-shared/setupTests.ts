import * as matchers from '@testing-library/jest-dom/matchers';
import { expect, vi } from 'vitest';
import createFetchMock from 'vitest-fetch-mock';

expect.extend(matchers);

//  set globalThis.fetch and globalThis.fetchMock
const fetchMocker = createFetchMock(vi);
fetchMocker.enableMocks();

vi.stubGlobal(
  'ResizeObserver',
  vi.fn(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn()
  }))
);

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
