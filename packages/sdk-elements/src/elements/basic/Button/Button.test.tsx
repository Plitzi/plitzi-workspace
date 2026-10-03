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
      <ElementContext value={elementEntry('btn')}>
        <Button />
      </ElementContext>
    );

    expect(baseElement).toBeTruthy();
  });

  it('says what it toggles only when told to', () => {
    const { getAllByRole } = render(
      <ElementContext value={elementEntry('btn')}>
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

  it('draws an icon beside its words, or alone with a title to name it', () => {
    const { getByRole } = render(
      <ElementContext value={elementEntry('btn')}>
        <Button content="Save" icon="fa-solid fa-floppy-disk" />
        <Button content="" icon="fa-solid fa-xmark" title="Close" />
      </ElementContext>
    );
    const save = getByRole('button', { name: 'Save' }).querySelector('i');
    const close = getByRole('button', { name: 'Close' }).querySelector('i');

    expect(getByRole('button', { name: 'Save' }).firstChild).toBe(save);
    expect(close?.getAttribute('aria-hidden')).toBe('true');
  });

  it('lets an empty content be named by its children or its title', () => {
    const { getByRole } = render(
      <ElementContext value={elementEntry('btn')}>
        <Button content="">
          <span>Refresh your spaces</span>
        </Button>
        <Button content="" title="Sign out" />
      </ElementContext>
    );

    expect(getByRole('button', { name: 'Refresh your spaces' }).hasAttribute('aria-label')).toBe(false);
    expect(getByRole('button', { name: 'Sign out' }).hasAttribute('aria-label')).toBe(false);
  });

  it('is named by everything it shows, never by its content alone', () => {
    const { getByRole } = render(
      <ElementContext value={elementEntry('btn')}>
        <Button content="">
          <span>Launch</span>
        </Button>
      </ElementContext>
    );

    expect(getByRole('button', { name: 'Launch' }).hasAttribute('aria-label')).toBe(false);
  });

  it('is named by its label when the words it shows are only a key hint', () => {
    const { getByRole } = render(
      <ElementContext value={elementEntry('btn')}>
        <Button content="V" label="Select (V)" title="Select — click a shape · V" />
      </ElementContext>
    );

    expect(getByRole('button', { name: 'Select (V)' })).toBeTruthy();
  });
});
