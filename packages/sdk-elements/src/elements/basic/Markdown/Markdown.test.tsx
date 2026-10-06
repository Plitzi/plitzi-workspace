import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { markdownHeadings } from '@plitzi/sdk-shared/schema/markdownHeadings';

import { Markdown } from './Markdown';
import ElementContext from '../../../Element/ElementContext';
import { skipHocEntry } from '../../../testUtils/elementTestUtils';

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
});
