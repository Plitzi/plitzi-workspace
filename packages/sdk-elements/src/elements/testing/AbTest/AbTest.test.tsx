import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { StoreProvider } from '@plitzi/nexus/react';

import { AbTest } from './AbTest';
import ElementContext from '../../../Element/ElementContext';
import { skipHocEntry } from '../../../tests/elementTestUtils';

import type { AbTestProps } from './AbTest';

vi.mock('../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

vi.mock('@plitzi/sdk-shared/hooks', async importOriginal => ({
  ...(await importOriginal<typeof import('@plitzi/sdk-shared/hooks')>()),
  usePlitzi: () => ({ settings: { previewMode: true } })
}));

/** An A/B test drawn in a store holding what the surface and the visitor's sources say. */
const drawn = (props: AbTestProps, store: Record<string, unknown> = {}) =>
  render(
    <StoreProvider value={store}>
      <ElementContext value={skipHocEntry('hero')}>
        <AbTest {...props}>
          <p>Variant A</p>
          <p>Variant B</p>
          <p>Variant C</p>
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

  it('draws in the builder the variant its settings name, whatever a visitor would be shown', () => {
    drawn(
      { experiment: 'heroTest', builderVariant: 'b' },
      { ...visitor({ heroTest: 'a' }), render: { builder: true } }
    );

    expect(screen.getByText('Variant B')).toBeTruthy();
    expect(screen.queryByText('Variant A')).toBeNull();
  });
});
