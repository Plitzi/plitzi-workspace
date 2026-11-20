import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createStore } from '@plitzi/nexus';
import { StoreProvider } from '@plitzi/nexus/react';

import AnalyticsReporter from './AnalyticsReporter';
import { setReporter } from './reporterRegistry';

import type { Reporter } from './createReporter';
import type { SdkState } from '@plitzi/sdk-shared';

const fakeReporter = () => {
  const track = vi.fn();
  const reporter: Reporter = { track, trackRender: vi.fn(), stop: vi.fn() } as unknown as Reporter; // Only what is read.
  setReporter(reporter);

  return track;
};

describe('AnalyticsReporter — A/B tests', () => {
  afterEach(() => {
    setReporter(undefined);
  });

  it('reports one visitor of each variant drawn, once, however often the page renders', () => {
    const track = fakeReporter();
    const store = createStore<Partial<SdkState>>({
      experiments: { drawn: ['heroTest'], assigned: { heroTest: 'b', pricing: 'a' } }
    });
    const page = () => (
      <MemoryRouter>
        <StoreProvider store={store}>
          <AnalyticsReporter />
        </StoreProvider>
      </MemoryRouter>
    );
    const { rerender } = render(page());
    rerender(page());

    expect(track.mock.calls).toEqual([['$experiment', { experiment: 'heroTest', variant: 'b' }]]);
  });
});
