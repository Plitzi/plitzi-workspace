import { fireEvent, render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { Image } from './Image';
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
});
