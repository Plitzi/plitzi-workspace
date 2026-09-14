import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { Button } from './Button';
import ElementContext from '../../../Element/ElementContext';
import { elementEntry } from '../../../testUtils/elementTestUtils';

vi.mock('../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

vi.mock('@plitzi/sdk-shared/hooks/usePlitziServiceContext', () => ({
  default: () => ({
    settings: { previewMode: true },
    root: { baseElementId: '' },
    contexts: {}
  })
}));

describe('Button Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(
      <ElementContext value={elementEntry('btn', { definition: { label: 'Button' } as never })}>
        <Button />
      </ElementContext>
    );

    expect(baseElement).toBeTruthy();
  });

  it('says what it toggles only when told to', () => {
    const { getAllByRole } = render(
      <ElementContext value={elementEntry('btn', { definition: { label: 'Button' } as never })}>
        <Button content="Plain" />
        <Button content="Menu" ariaExpanded={false} />
        <Button content="Filter" ariaPressed />
      </ElementContext>
    );
    const [plain, menu, filter] = getAllByRole('button');

    expect(plain.hasAttribute('aria-expanded')).toBe(false);
    expect(plain.hasAttribute('aria-pressed')).toBe(false);
    expect(menu.getAttribute('aria-expanded')).toBe('false');
    expect(filter.getAttribute('aria-pressed')).toBe('true');
  });
});
