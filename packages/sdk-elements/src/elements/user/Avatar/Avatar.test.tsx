import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Avatar } from './Avatar';
import ElementContext from '../../../Element/ElementContext';
import { elementEntry } from '../../../tests/elementTestUtils';

import type { AvatarProps } from './Avatar';

vi.mock('../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

vi.mock('@plitzi/sdk-shared/hooks', async importOriginal => ({
  ...(await importOriginal<typeof import('@plitzi/sdk-shared/hooks')>()),
  usePlitzi: () => ({ settings: { previewMode: true } })
}));

const entry = elementEntry('author', {
  plitziJsxSkipHOC: true,
  definition: { rootId: 'root', label: 'Avatar', type: 'avatar', styleSelectors: { base: '', image: 'round' } }
});

const drawn = (props: AvatarProps) =>
  render(
    <ElementContext value={entry}>
      <Avatar {...props} />
    </ElementContext>
  ).container.querySelector<HTMLElement>('.plitzi-component__avatar');

describe('Avatar', () => {
  it('shows their picture, and their initials once it does not load', () => {
    const box = drawn({ src: 'https://cdn.test/ada.jpg', name: 'Ada Lovelace' });
    const picture = box?.querySelector('img');
    if (!picture) {
      throw new Error('no picture');
    }

    expect(picture.classList.contains('round')).toBe(true);
    fireEvent.error(picture);
    expect(box?.textContent).toBe('AL');
    expect(box?.querySelector('img')).toBeNull();
  });

  it('shows the initials for a picture that failed before the page hydrated', () => {
    const complete = vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
    const width = vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(0);

    expect(drawn({ src: 'https://cdn.test/gone.jpg', name: 'Grace Hopper' })?.textContent).toBe('GH');
    complete.mockRestore();
    width.mockRestore();
  });

  it('is said by its name, on a colour of its own — and not at all when decorative', () => {
    const box = drawn({ name: 'Ada Lovelace' });

    expect(box?.getAttribute('role')).toBe('img');
    expect(box?.getAttribute('aria-label')).toBe('Ada Lovelace');
    expect(box?.style.getPropertyValue('--plitzi-avatar-hue')).not.toBe('');
    expect(drawn({ name: 'Ada Lovelace', decorative: true })?.getAttribute('aria-hidden')).toBe('true');
  });

  it('draws a person’s outline when it has not even a name, and says nothing', () => {
    const box = drawn({});

    expect(box?.querySelector('svg')).not.toBeNull();
    expect(box?.getAttribute('aria-hidden')).toBe('true');
  });
});
