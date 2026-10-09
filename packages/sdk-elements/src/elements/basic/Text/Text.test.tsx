import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { Text } from './Text';
import ElementContext from '../../../Element/ElementContext';
import { skipHocEntry } from '../../../testUtils/elementTestUtils';

vi.mock('../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

vi.mock('@plitzi/sdk-shared/hooks/usePlitzi', () => ({
  default: () => ({
    settings: { previewMode: true }
  })
}));

describe('Text Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(
      <ElementContext value={skipHocEntry()}>
        <Text />
      </ElementContext>
    );

    expect(baseElement).toBeTruthy();
  });

  it('shows its title to a pointer resting on it', () => {
    const { getByText } = render(
      <ElementContext value={skipHocEntry()}>
        <Text content="UTC" title="Coordinated Universal Time" />
      </ElementContext>
    );

    expect(getByText('UTC').getAttribute('title')).toBe('Coordinated Universal Time');
  });

  // A seal or a mark drawn for the look: a screen reader skips it, as it skips a decorative container.
  it('is skipped by a screen reader when it is decorative', () => {
    const { getByText } = render(
      <ElementContext value={skipHocEntry()}>
        <Text content="福" decorative />
      </ElementContext>
    );

    expect(getByText('福').getAttribute('aria-hidden')).toBe('true');
  });
});
