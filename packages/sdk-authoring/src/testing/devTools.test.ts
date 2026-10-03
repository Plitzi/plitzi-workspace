import { afterEach, describe, expect, it, vi } from 'vitest';

import { failedFlowText, readDevToolsInPage } from './devTools';

import type { DevToolsFlow } from './devTools';

const failed: DevToolsFlow = {
  at: '12:00:00.000',
  trigger: 'On Load [onLoad]',
  on: 'hero',
  status: 'failed',
  ms: 40,
  steps: [
    { title: 'Set State', action: 'setState', status: 'success', ms: 1 },
    { title: 'Web Hook', action: 'webHook', status: 'failed', ms: 39, error: 'HTTP 404' }
  ]
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the dev tools, read from the page', () => {
  it('says a failed flow in a line, with the steps that failed', () => {
    expect(failedFlowText(failed)).toBe('flow On Load [onLoad] on hero failed — Web Hook [webHook]: HTTP 404');
  });

  it('reads the flows and, when asked, the state, the sources and an element', () => {
    vi.stubGlobal('window', {
      __plitzi: {
        flows: () => [failed, { nonsense: true }],
        state: () => ({ category: 'paper' }),
        sources: () => ({ apiContainer_site: { data: {} } }),
        element: (id: string) => ({ id, visible: true })
      }
    });

    expect(readDevToolsInPage({ state: true, element: 'count' })).toEqual({
      available: true,
      flows: [failed],
      state: { category: 'paper' },
      sources: { apiContainer_site: { data: {} } },
      element: { id: 'count', visible: true }
    });
  });

  it('says there is nothing to read on a page without its dev tools', () => {
    vi.stubGlobal('window', {});

    expect(readDevToolsInPage({ state: true })).toEqual({ available: false, flows: [] });
  });
});
