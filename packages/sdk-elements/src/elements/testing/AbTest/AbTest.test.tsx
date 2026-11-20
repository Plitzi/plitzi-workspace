import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { StoreProvider } from '@plitzi/nexus/react';

import { AbTest } from './AbTest';
import ElementContext from '../../../Element/ElementContext';
import { elementEntry } from '../../../tests/elementTestUtils';

import type { AbTestProps } from './AbTest';

vi.mock('../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

vi.mock('@plitzi/sdk-shared/hooks', async importOriginal => ({
  ...(await importOriginal<typeof import('@plitzi/sdk-shared/hooks')>()),
  usePlitzi: () => ({ settings: { previewMode: true } })
}));

/** The test's own entry: its variants are its items, A first, drawn as children keyed by them. */
const hero = elementEntry('hero', {
  plitziJsxSkipHOC: true,
  definition: {
    rootId: 'root',
    label: 'A/B Test',
    type: 'abTest',
    styleSelectors: { base: '' },
    items: ['heroA', 'heroB', 'heroC']
  }
});

/** An A/B test drawn in a store holding what the surface and the visitor's sources say. */
const drawn = (props: AbTestProps, store: Record<string, unknown> = {}) =>
  render(
    <StoreProvider value={store}>
      <ElementContext value={hero}>
        <AbTest {...props}>
          <p key="heroA">Variant A</p>
          <p key="heroB">Variant B</p>
          <p key="heroC">Variant C</p>
        </AbTest>
      </ElementContext>
    </StoreProvider>
  );

const visitor = (experiments: Record<string, string>) => ({ runtime: { sources: { experiments } } });

describe('AbTest', () => {
  it('draws the variant the visitor is shown, and not the other at all', () => {
    drawn({ experiment: 'heroTest' }, visitor({ heroTest: 'b' }));

    expect(screen.getByText('Variant B')).toBeTruthy();
    expect(screen.queryByText('Variant A')).toBeNull();
  });

  it('draws a third variant, by its place', () => {
    drawn({ experiment: 'heroTest' }, visitor({ heroTest: 'c' }));

    expect(screen.getByText('Variant C')).toBeTruthy();
    expect(screen.queryByText('Variant A')).toBeNull();
  });

  it('draws A for a visitor not assigned yet, and for a test with no name', () => {
    const { unmount } = drawn({ experiment: 'heroTest' });
    expect(screen.getByText('Variant A')).toBeTruthy();
    unmount();

    drawn({ experiment: '' }, visitor({ '': 'b' }));
    expect(screen.getByText('Variant A')).toBeTruthy();
  });

  it('draws while editing in the builder the variant its settings name, whatever a visitor would be shown', () => {
    drawn(
      { experiment: 'heroTest', builderVariant: 'b' },
      { ...visitor({ heroTest: 'a' }), render: { builder: true, previewMode: false } }
    );

    expect(screen.getByText('Variant B')).toBeTruthy();
    expect(screen.queryByText('Variant A')).toBeNull();
  });
});
