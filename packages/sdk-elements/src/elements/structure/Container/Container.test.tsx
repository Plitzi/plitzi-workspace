import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { Container } from './Container';
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

describe('Container Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(
      <ElementContext value={skipHocEntry()}>
        <Container />
      </ElementContext>
    );

    expect(baseElement).toBeTruthy();
  });

  it('names a landmark by its label', () => {
    const { getByRole } = render(
      <ElementContext value={skipHocEntry()}>
        <Container subType="nav" label="Main navigation" />
      </ElementContext>
    );

    expect(getByRole('navigation', { name: 'Main navigation' })).toBeTruthy();
  });

  it('makes a named div a group, and a named section a region', () => {
    const { getByRole } = render(
      <ElementContext value={skipHocEntry()}>
        <Container label="Filters" />
        <Container subType="section" label="Search results" />
      </ElementContext>
    );

    expect(getByRole('group', { name: 'Filters' })).toBeTruthy();
    expect(getByRole('region', { name: 'Search results' })).toBeTruthy();
  });

  it('leaves a tag that takes its name from its contents alone', () => {
    const { container } = render(
      <ElementContext value={skipHocEntry()}>
        <Container subType="li" label="Ignored" />
      </ElementContext>
    );

    expect(container.querySelector('li')?.getAttribute('aria-label')).toBeNull();
  });

  it('hides an illustration from assistive technology, name and all', () => {
    const { container } = render(
      <ElementContext value={skipHocEntry()}>
        <Container label="Ignored" decorative />
      </ElementContext>
    );
    const box = container.querySelector('div');

    expect(box?.getAttribute('aria-hidden')).toBe('true');
    expect(box?.getAttribute('aria-label')).toBeNull();
  });
});
