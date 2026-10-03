import { fireEvent, render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { Image } from './Image';
import ElementContext from '../../../Element/ElementContext';
import { skipHocEntry } from '../../../testUtils/elementTestUtils';

vi.mock('../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

// What the page server published: a test sets it, and `undefined` is a render with no page server.
const published = vi.hoisted((): { endpoint?: string } => ({}));

vi.mock('@plitzi/sdk-shared/store', async importOriginal => ({
  ...(await importOriginal<typeof import('@plitzi/sdk-shared/store')>()),
  useCommonStore: (path: string) => [path === 'images.endpoint' ? published.endpoint : undefined]
}));

vi.mock('@plitzi/sdk-shared/hooks/usePlitziServiceContext', () => ({
  default: () => ({
    settings: { previewMode: true },
    contexts: {}
  })
}));

describe('Image Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(
      <ElementContext value={skipHocEntry()}>
        <Image />
      </ElementContext>
    );

    expect(baseElement).toBeTruthy();
  });

  /** The fallback loads, so without the marker a broken image and a working one are the same thing on the page. */
  it('draws the fallback for a source that failed, and says which one', () => {
    const { container, rerender } = render(
      <ElementContext value={skipHocEntry()}>
        <Image src="https://cdn.test/missing.png" />
      </ElementContext>
    );
    const image = container.querySelector('img');
    if (!image) {
      throw new Error('no img rendered');
    }

    expect(image.getAttribute('data-plitzi-failed')).toBeNull();

    fireEvent.error(image);

    expect(image.getAttribute('data-plitzi-failed')).toBe('https://cdn.test/missing.png');
    expect(image.getAttribute('src')).toMatch(/^data:image\/svg\+xml;base64,/);

    rerender(
      <ElementContext value={skipHocEntry()}>
        <Image src="https://cdn.test/found.png" />
      </ElementContext>
    );

    expect(image.getAttribute('data-plitzi-failed')).toBeNull();
    expect(image.getAttribute('src')).toBe('https://cdn.test/found.png');
  });

  it('offers another site’s picture at the sizes the page server makes, when it makes them', () => {
    published.endpoint = '/_plitzi/img';
    const { container } = render(
      <ElementContext value={skipHocEntry()}>
        <Image src="https://cdn.test/fox.jpg" alt="A fox" sizes="360px" width={1200} height={800} />
      </ElementContext>
    );
    const image = container.querySelector('img');

    expect(image?.getAttribute('src')).toBe('/_plitzi/img?url=https%3A%2F%2Fcdn.test%2Ffox.jpg&w=1280');
    expect(image?.getAttribute('srcset')).toContain('&w=320 320w');
    expect(image?.getAttribute('sizes')).toBe('360px');
    expect(image?.getAttribute('width')).toBe('1200');
    published.endpoint = undefined;
  });

  it('keeps its own src with no page server, and for a picture of the site itself', () => {
    const { container, rerender } = render(
      <ElementContext value={skipHocEntry()}>
        <Image src="https://cdn.test/fox.jpg" />
      </ElementContext>
    );

    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://cdn.test/fox.jpg');
    expect(container.querySelector('img')?.hasAttribute('srcset')).toBe(false);

    published.endpoint = '/_plitzi/img';
    rerender(
      <ElementContext value={skipHocEntry()}>
        <Image src="/hero.jpg" />
      </ElementContext>
    );

    expect(container.querySelector('img')?.getAttribute('src')).toBe('/hero.jpg');
    published.endpoint = undefined;
  });
});
