import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { FontAwesome } from './FontAwesome';
import ElementContext from '../../../Element/ElementContext';
import { skipHocEntry } from '../../../testUtils/elementTestUtils';

vi.mock('../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

vi.mock('@plitzi/sdk-shared/hooks/usePlitziServiceContext', () => ({
  default: () => ({
    settings: { previewMode: true },
    contexts: {}
  })
}));

describe('FontAwesome Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(
      <ElementContext value={skipHocEntry()}>
        <FontAwesome />
      </ElementContext>
    );

    expect(baseElement).toBeTruthy();
  });

  it('is decoration unless it is given a meaning', () => {
    const { container } = render(
      <ElementContext value={skipHocEntry()}>
        <FontAwesome icon="fa-solid fa-star" />
      </ElementContext>
    );
    const icon = container.querySelector('i');

    expect(icon?.getAttribute('aria-hidden')).toBe('true');
    expect(icon?.getAttribute('role')).toBeNull();
  });

  it('is an image named by its label when it says something on its own', () => {
    const { getByRole } = render(
      <ElementContext value={skipHocEntry()}>
        <FontAwesome icon="fa-solid fa-triangle-exclamation" label="Payment overdue" />
      </ElementContext>
    );

    expect(getByRole('img', { name: 'Payment overdue' }).getAttribute('aria-hidden')).toBeNull();
  });
});
