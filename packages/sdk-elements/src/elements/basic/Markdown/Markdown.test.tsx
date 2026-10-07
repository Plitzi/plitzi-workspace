import { MARKDOWN_PARTS } from '@plitzi/plitzi-ui/Markdown';
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { markdownHeadings } from '@plitzi/sdk-shared/schema/markdownHeadings';

import declaration from './declaration';
import { Markdown } from './Markdown';
import ElementContext from '../../../Element/ElementContext';
import { elementEntry, skipHocEntry } from '../../../testUtils/elementTestUtils';

vi.mock('../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

vi.mock('@plitzi/sdk-shared/hooks/usePlitziServiceContext', () => ({
  default: () => ({ settings: { previewMode: true }, contexts: {} })
}));

const content = [
  '# A space in code',
  '## One `import`',
  'Text with **bold**.',
  '```ts',
  '## not a heading',
  '```',
  '### The [`link`](./link.md) element',
  '## Café & crème',
  '## One import'
].join('\n');

describe('Markdown', () => {
  it('renders every heading with the anchor authoring checks a link’s hash against', () => {
    const { container } = render(
      <ElementContext value={skipHocEntry()}>
        <Markdown content={content} />
      </ElementContext>
    );

    const rendered = [...container.querySelectorAll('h1, h2, h3, h4, h5, h6')].map(heading => heading.id);

    expect(rendered).toEqual(markdownHeadings(content).map(heading => heading.anchor));
    expect(rendered).toEqual(['a-space-in-code', 'one-import', 'the-link-element', 'cafe-creme', 'one-import-2']);
  });

  it('puts the class of each slot on its part of the document', () => {
    const entry = elementEntry('notes', {
      plitziJsxSkipHOC: true,
      definition: {
        rootId: 'root',
        label: 'notes',
        type: 'markdown',
        styleSelectors: {
          base: '',
          heading: 'note-heading',
          heading2: 'note-h2',
          paragraph: 'note-p',
          link: 'note-link',
          anchor: 'note-anchor'
        }
      }
    });
    const { container } = render(
      <ElementContext value={entry}>
        <Markdown content={'## Title\n\nSee [the docs](/docs).'} />
      </ElementContext>
    );

    expect(container.querySelector('h2')?.className).toBe('note-heading note-h2');
    expect(container.querySelector('h2 > a')?.className).toBe('anchor note-anchor');
    expect(container.querySelector('p')?.className).toBe('note-p');
    expect(container.querySelector('p > a')?.className).toBe('note-link');
  });

  it('offers a slot for every part of the document', () => {
    const { base, ...slots } = declaration.content.definition.styleSelectors;

    expect(base).toBe('');
    expect(Object.keys(slots)).toEqual([...MARKDOWN_PARTS]);
  });

  it('keeps every heading id and leaves the link to it out with headingLinks off', () => {
    const { container } = render(
      <ElementContext value={skipHocEntry()}>
        <Markdown content="## Café & crème" headingLinks={false} />
      </ElementContext>
    );

    expect(container.querySelector('h2')?.id).toBe('cafe-creme');
    expect(container.querySelector('a.anchor')).toBeNull();
  });
});
