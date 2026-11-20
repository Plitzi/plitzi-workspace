import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { StoreProvider } from '@plitzi/nexus/react';
import { experimentsCookieName } from '@plitzi/sdk-shared/experiments';

import useExperiments from './useExperiments';

import type { ExperimentAssignments } from '@plitzi/sdk-shared/experiments';

/** Named for the page's port, as the SDK names it. */
const cookie = () => experimentsCookieName(window.location.host);

const node = (id: string, type: string, attributes: Record<string, unknown>, items: string[] = []) => ({
  id,
  attributes,
  definition: { rootId: id, label: type, type, styleSelectors: { base: '' }, items }
});

/** An A/B test with two variants of equal weight. */
const abTest = (id: string, experiment: string, builderVariant = 'a') => ({
  [id]: node(id, 'abTest', { experiment, builderVariant }, [`${id}A`, `${id}B`]),
  [`${id}A`]: node(`${id}A`, 'abTestVariant', { weight: 50 }),
  [`${id}B`]: node(`${id}B`, 'abTestVariant', { weight: 50 })
});

const flat = { ...abTest('hero', 'heroTest', 'b'), ...abTest('price', 'pricing') };

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
    vi.spyOn(Math, 'random').mockReturnValue(0.1);

    expect(assigned()).toEqual({ heroTest: 'b', pricing: 'a' });
    expect(decodeURIComponent(document.cookie)).toContain(`${cookie()}=heroTest:b,pricing:a`);
  });

  it('shows what a tester forced over the visitor’s variant, and never keeps it as theirs', () => {
    const shown = assigned({ experiments: { server: { heroTest: 'a', pricing: 'a' }, qa: { heroTest: 'b' } } });

    expect(shown).toEqual({ heroTest: 'b', pricing: 'a' });
    expect(document.cookie).not.toContain(cookie());
  });

  it('says what a tester forced and cannot be shown, and shows the visitor’s', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const shown = assigned({
      experiments: { server: { heroTest: 'a', pricing: 'a' }, qa: { heroTset: 'b', pricing: 'e' } }
    });

    expect(shown).toEqual({ heroTest: 'a', pricing: 'a' });
    expect(warn.mock.calls.map(([message]) => String(message))).toEqual([
      expect.stringContaining('"heroTset" is forced to B, but no A/B test of this space runs it'),
      expect.stringContaining('"pricing" is forced to E, a variant its A/B test does not have')
    ]);
  });

  it('shows the builder the variant each test’s settings name, and keeps nothing', () => {
    expect(assigned({ render: { builder: true } })).toEqual({ heroTest: 'b', pricing: 'a' });
    expect(document.cookie).not.toContain(cookie());
  });
});
