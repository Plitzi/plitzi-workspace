import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Embed } from './Embed';
import { embeddableSrc } from './embeddableSrc';
import ElementContext from '../../../Element/ElementContext';
import { skipHocEntry } from '../../../testUtils/elementTestUtils';

vi.mock('../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

vi.mock('@plitzi/sdk-shared/hooks/usePlitziServiceContext', () => ({
  default: () => ({ settings: { previewMode: true }, contexts: {} })
}));

describe('Embed', () => {
  it('is a frame with its title, loaded lazily', () => {
    const { container } = render(
      <ElementContext value={skipHocEntry()}>
        <Embed src="https://www.openstreetmap.org/export/embed.html" title="Our shop on the map" />
      </ElementContext>
    );
    const frame = container.querySelector('iframe');

    expect(frame?.getAttribute('src')).toBe('https://www.openstreetmap.org/export/embed.html');
    expect(frame?.getAttribute('title')).toBe('Our shop on the map');
    expect(frame?.getAttribute('loading')).toBe('lazy');
    expect(frame?.hasAttribute('sandbox')).toBe(false);
  });

  it('loads only a web address or a path of the site', () => {
    expect(embeddableSrc('https://example.com')).toBe('https://example.com');
    expect(embeddableSrc('//example.com/x')).toBe('//example.com/x');
    expect(embeddableSrc('/widgets/map')).toBe('/widgets/map');
    expect(embeddableSrc('javascript:alert(1)')).toBeUndefined();
    expect(embeddableSrc('data:text/html,<script>')).toBeUndefined();
  });
});
