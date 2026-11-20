import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { StoreProvider } from '@plitzi/nexus/react';
import { experimentsCookieName } from '@plitzi/sdk-shared/experiments';

import useExperiments from './useExperiments';

import type { ExperimentAssignments } from '@plitzi/sdk-shared/experiments';

/** Named for the page's port, as the SDK names it. */
const cookie = () => experimentsCookieName(window.location.host);

const abTest = (id: string, experiment: string, split: number, builderVariant = 'a') => ({
  id,
  attributes: { experiment, split, builderVariant },
  definition: { rootId: id, label: 'A/B Test', type: 'abTest', styleSelectors: { base: '' } }
});

const flat = { hero: abTest('hero', 'heroTest', 50, 'b'), price: abTest('price', 'pricing', 50) };

const clearCookie = () => {
  document.cookie = `${cookie()}=; Path=/; Max-Age=0`;
};

/** What the hook answers in a store holding the space's elements and what the surface seeded. */
const assigned = (store: Record<string, unknown> = {}): ExperimentAssignments => {
  let answer: ExperimentAssignments = {};
  const Probe = () => {
    answer = useExperiments();

    return null;
  };

  render(
    <StoreProvider value={{ schema: { flat, components: {} }, ...store }}>
      <Probe />
    </StoreProvider>
  );

  return answer;
};

describe('useExperiments', () => {
  beforeEach(clearCookie);
  afterEach(() => {
    clearCookie();
    vi.restoreAllMocks();
  });

  it('hydrates with what the server drew, and draws nothing of its own', () => {
    const random = vi.spyOn(Math, 'random');

    expect(assigned({ experiments: { server: { heroTest: 'b', pricing: 'a' } } })).toEqual({
      heroTest: 'b',
      pricing: 'a'
    });
    expect(random).not.toHaveBeenCalled();
    expect(document.cookie).not.toContain(cookie());
  });

  it('reads what the visitor kept, and draws and keeps only what they have not', () => {
    document.cookie = `${cookie()}=heroTest%3Ab; Path=/`;
    vi.spyOn(Math, 'random').mockReturnValue(0.9);

    expect(assigned()).toEqual({ heroTest: 'b', pricing: 'a' });
    expect(decodeURIComponent(document.cookie)).toContain(`${cookie()}=heroTest:b,pricing:a`);
  });

  it('shows the builder the variant each test’s settings name, and keeps nothing', () => {
    expect(assigned({ render: { builder: true } })).toEqual({ heroTest: 'b', pricing: 'a' });
    expect(document.cookie).not.toContain(cookie());
  });
});
