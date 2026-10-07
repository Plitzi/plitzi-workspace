import { MARKDOWN_PARTS } from '@plitzi/plitzi-ui/Markdown';
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import declaration from './declaration';
import { RichText } from './RichText';
import ElementContext from '../../../Element/ElementContext';
import { elementEntry } from '../../../testUtils/elementTestUtils';

vi.mock('../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

vi.mock('@plitzi/sdk-shared/hooks/usePlitziServiceContext', () => ({
  default: () => ({ settings: { previewMode: true }, contexts: {} })
}));

const entry = elementEntry('body', {
  plitziJsxSkipHOC: true,
  definition: {
    rootId: 'root',
    label: 'body',
    type: 'richText',
    styleSelectors: { base: '', heading: 'body-heading', heading2: 'body-h2', paragraph: 'body-p', link: 'body-link' }
  }
});

describe('RichText', () => {
  it('offers the slots of a markdown document but the link a heading offers to itself', () => {
    const { base, ...slots } = declaration.content.definition.styleSelectors;

    expect(base).toBe('');
    expect(Object.keys(slots)).toEqual(MARKDOWN_PARTS.filter(part => part !== 'anchor'));
  });

  it('puts the class of each slot on its part of an HTML body', () => {
    const { container } = render(
      <ElementContext value={entry}>
        <RichText content={'<h2>Title</h2><p>See <a href="/docs">the docs</a>.</p>'} format="html" />
      </ElementContext>
    );

    expect(container.querySelector('h2')?.className).toBe('body-heading body-h2');
    expect(container.querySelector('p')?.className).toBe('body-p');
    expect(container.querySelector('p > a')?.className).toBe('body-link');
  });

  it('puts the same classes on the same parts of a markdown body', () => {
    const { container } = render(
      <ElementContext value={entry}>
        <RichText content={'## Title\n\nSee [the docs](/docs).'} format="markdown" />
      </ElementContext>
    );

    expect(container.querySelector('h2')?.className).toBe('body-heading body-h2');
    expect(container.querySelector('p')?.className).toBe('body-p');
    expect(container.querySelector('p > a')?.className).toBe('body-link');
  });
});
