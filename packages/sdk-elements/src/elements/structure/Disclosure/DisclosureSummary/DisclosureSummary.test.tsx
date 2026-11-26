import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DisclosureSummary } from './DisclosureSummary';
import ElementContext from '../../../../Element/ElementContext';
import { elementEntry } from '../../../../tests/elementTestUtils';

vi.mock('../../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

vi.mock('@plitzi/sdk-shared/hooks', async importOriginal => ({
  ...(await importOriginal<typeof import('@plitzi/sdk-shared/hooks')>()),
  usePlitzi: () => ({ settings: { previewMode: true } })
}));

const entry = elementEntry('summary', {
  plitziJsxSkipHOC: true,
  definition: {
    rootId: 'root',
    label: 'Summary',
    type: 'disclosureSummary',
    styleSelectors: { base: '', marker: 'plus' }
  }
});

const drawn = (marker?: boolean, label?: string) =>
  render(
    <ElementContext value={entry}>
      <DisclosureSummary marker={marker} label={label}>
        Can I cancel?
      </DisclosureSummary>
    </ElementContext>
  ).container;

describe('DisclosureSummary', () => {
  it('is a <summary> ending in its marker, in the marker slot’s class and out of what is read', () => {
    const marker = drawn().querySelector('summary > .plitzi-component__disclosure-marker');

    expect(marker?.classList.contains('plus')).toBe(true);
    expect(marker?.getAttribute('aria-hidden')).toBe('true');
  });

  it('draws no marker when told, for a sign of its own', () => {
    expect(drawn(false).querySelector('.plitzi-component__disclosure-marker')).toBeNull();
  });

  // A menu's burger: an icon alone, named by its label — its words name it otherwise, and no empty name is written.
  it('is named by its label when it has one, and by its words when not', () => {
    expect(drawn(false, 'Menu').querySelector('summary')?.getAttribute('aria-label')).toBe('Menu');
    expect(drawn(false).querySelector('summary')?.hasAttribute('aria-label')).toBe(false);
  });
});
