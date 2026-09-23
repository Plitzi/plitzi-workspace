import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { StoreProvider } from '@plitzi/nexus/react';

import { Link } from './Link';
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

const navigation = {
  routeParams: {},
  queryParams: {},
  hostname: 'example.test',
  currentPageId: 'page-1'
};

// `pageDefinitions` and `schema.pageFolders` are what a link resolves its href against: the component reads both
// unconditionally, so an empty store is not a smaller case of the real one, it is a crash.
const storeValue = { navigation, pageDefinitions: {}, schema: { pageFolders: [] } };

describe('Link Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(
      <StoreProvider value={storeValue}>
        <ElementContext value={skipHocEntry()}>
          <Link />
        </ElementContext>
      </StoreProvider>
    );

    expect(baseElement).toBeTruthy();
  });

  describe('href resolution', () => {
    const slotted = (id: string, attributes: Record<string, unknown> = {}) => ({
      id,
      attributes: { slug: id, folder: '', default: false, ...attributes },
      definition: { rootId: id, label: id, type: 'page' as const, items: [], styleSelectors: { base: '' } }
    });

    const pageDefinitions = {
      arcade: slotted('arcade'),
      audience: slotted('audience', { folder: 'arcade' })
    };
    const withPages = {
      navigation,
      pageDefinitions,
      schema: { pageFolders: [{ id: 'arcade', name: 'Arcade', slug: 'arcade', parentId: '' }] }
    };

    const anchorHref = (props: Partial<Parameters<typeof Link>[0]> = {}) => {
      const { container } = render(
        <StoreProvider value={withPages}>
          <ElementContext value={skipHocEntry()}>
            <Link {...props} />
          </ElementContext>
        </StoreProvider>
      );

      return container.querySelector('a')?.getAttribute('href');
    };

    it('resolves a page id written with a leading slash to the page path, not //arcade', () => {
      expect(anchorHref({ mode: 'page', href: '/arcade' })).toBe('/arcade');
      expect(anchorHref({ mode: 'page', href: '//arcade' })).toBe('/arcade');
    });

    it('resolves a folder page the same way by id or by path', () => {
      expect(anchorHref({ mode: 'page', href: '/audience' })).toBe('/arcade/audience');
      expect(anchorHref({ mode: 'page', href: '/arcade/audience' })).toBe('/arcade/audience');
    });

    it('keeps the home link at the root path', () => {
      expect(anchorHref({ mode: 'page', href: '/' })).toBe('/');
    });

    it('keeps an internal path collapsed and an external URL untouched', () => {
      expect(anchorHref({ mode: 'internal', href: '/arcade/' })).toBe('/arcade/');
      expect(anchorHref({ mode: 'external', href: 'https://plitzi.com/a//b' })).toBe('https://plitzi.com/a//b');
    });
  });
});
