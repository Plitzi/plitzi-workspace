import { act, fireEvent, render } from '@testing-library/react';
import { StrictMode } from 'react';
import { describe, it, expect, vi } from 'vitest';

import { MARKDOWN_PARTS } from './helpers/markdownParts';
import MarkdownDocument from './MarkdownDocument';

describe('MarkdownDocument', () => {
  it('writes inline code with nothing of the syntax tree on the tag', () => {
    const { container } = render(<MarkdownDocument>{'## `pull`\n\nRun `plitzi pull`.'}</MarkdownDocument>);
    const codes = [...container.querySelectorAll('code')];

    expect(codes.map(code => code.textContent)).toEqual(['pull', 'plitzi pull']);
    codes.forEach(code => expect(code.hasAttribute('node')).toBe(false));
  });

  it('writes a fenced block highlighted, without the syntax tree either', () => {
    const { container } = render(<MarkdownDocument>{'```ts\nconst a = 1;\n```'}</MarkdownDocument>);

    expect(container.textContent).toContain('const a = 1;');
    expect(container.querySelector('[node]')).toBeNull();
  });

  describe('headings', () => {
    // What a consumer supplies: the same words always get the same id, numbered the second time.
    const anchor = (text: string, taken: Set<string>) => {
      const base = text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const id = taken.has(base) ? `${base}-2` : base;
      taken.add(id);

      return id;
    };

    it('carry the id the consumer gives them, with a link to themselves', () => {
      const { container } = render(
        <MarkdownDocument headingAnchor={anchor}>{'## One `import`\n\n### Two\n\n## One import'}</MarkdownDocument>
      );
      const headings = [...container.querySelectorAll('h2, h3')];

      expect(headings.map(heading => heading.id)).toEqual(['one-import', 'two', 'one-import-2']);
      expect(headings[0].querySelector('a.anchor')?.getAttribute('href')).toBe('#one-import');
      expect(headings[0].querySelector('a.anchor')?.getAttribute('aria-label')).toBe('Link to “One import”');
    });

    it('keep their ids however many times React renders them', () => {
      const { container } = render(
        <StrictMode>
          <MarkdownDocument headingAnchor={anchor}>{'## Same\n\n## Same'}</MarkdownDocument>
        </StrictMode>
      );

      expect([...container.querySelectorAll('h2')].map(heading => heading.id)).toEqual(['same', 'same-2']);
    });

    it('keep their ids and offer no link to themselves with headingLinks off', () => {
      const { container } = render(
        <MarkdownDocument headingAnchor={anchor} headingLinks={false}>
          {'## One import'}
        </MarkdownDocument>
      );

      expect(container.querySelector('h2')?.id).toBe('one-import');
      expect(container.querySelector('a.anchor')).toBeNull();
      expect(container.querySelector('h2')?.textContent).toBe('One import');
    });

    it('carry no id and no link when nobody says what it is', () => {
      const { container } = render(<MarkdownDocument>{'## Plain'}</MarkdownDocument>);

      expect(container.querySelector('h2')?.hasAttribute('id')).toBe(false);
      expect(container.querySelector('a.anchor')).toBeNull();
    });
  });

  describe('a fenced block', () => {
    it('says what it is written in, and copies exactly its text', async () => {
      const writeText = vi.fn(() => Promise.resolve());
      Object.assign(navigator, { clipboard: { writeText } });
      const { container, getByRole } = render(<MarkdownDocument>{'```ts\nconst a = 1;\n```'}</MarkdownDocument>);

      expect(container.querySelector('.markdown-code-language')?.textContent).toBe('ts');
      await act(async () => {
        fireEvent.click(getByRole('button', { name: 'Copy' }));
        await Promise.resolve();
      });

      expect(writeText).toHaveBeenCalledWith('const a = 1;');
      expect(getByRole('button', { name: 'Copied' })).toBeTruthy();
    });

    it('without a language is still one, named as text', () => {
      const { container } = render(<MarkdownDocument>{'```\nplain\n```'}</MarkdownDocument>);

      expect(container.querySelector('.markdown-code-language')?.textContent).toBe('text');
    });
  });

  describe('the class of each part', () => {
    const classNames = Object.fromEntries(MARKDOWN_PARTS.map(part => [part, `doc-${part}`]));
    const source = [
      '# Top',
      '## Title',
      'A [link](https://plitzi.com), `code`, **strong** and *emphasis*.',
      '- one\n- two',
      '1. first',
      '> said',
      '---',
      '![A fox](/fox.jpg)',
      '| a |\n| - |\n| b |',
      '```ts\nconst a = 1;\n```'
    ].join('\n\n');

    it('puts each part under the class given for it', () => {
      const { container } = render(
        <MarkdownDocument classNames={classNames} headingAnchor={text => text.toLowerCase()}>
          {source}
        </MarkdownDocument>
      );
      const classOf = (selector: string) => container.querySelector(selector)?.getAttribute('class');

      expect(classOf('h1')).toBe('doc-heading doc-heading1');
      expect(classOf('h2')).toBe('doc-heading doc-heading2');
      expect(classOf('h2 > a')).toBe('anchor doc-anchor');
      expect(classOf('p')).toBe('doc-paragraph');
      expect(classOf('p > a')).toBe('doc-link');
      expect(classOf('p > code')).toBe('doc-code');
      expect(classOf('p > strong')).toBe('doc-strong');
      expect(classOf('p > em')).toBe('doc-emphasis');
      expect(classOf('ul')).toBe('doc-list');
      expect(classOf('ol')).toBe('doc-list');
      expect(classOf('li')).toBe('doc-listItem');
      expect(classOf('blockquote')).toBe('doc-quote');
      expect(classOf('hr')).toBe('doc-divider');
      expect(classOf('img')).toBe('doc-image');
      expect(classOf('table')).toBe('doc-table');
      expect(classOf('thead')).toBe('doc-tableHead');
      expect(classOf('tr')).toBe('doc-tableRow');
      expect(classOf('th')).toBe('doc-tableHeaderCell');
      expect(classOf('td')).toBe('doc-tableCell');
      expect(classOf('pre')).toBe('doc-codeBlock');
      expect(classOf('.markdown-code')).toBe('markdown-code doc-codeBlockFrame');
      expect(classOf('.markdown-code-header')).toBe('markdown-code-header doc-codeBlockHeader');
      expect(classOf('.markdown-code-language')).toBe('markdown-code-language doc-codeBlockLanguage');
      expect(classOf('.markdown-code-copy')).toBe('markdown-code-copy doc-codeBlockCopy');
    });

    it('reaches every part it names', () => {
      const { container } = render(
        <MarkdownDocument classNames={classNames} headingAnchor={text => text.toLowerCase()}>
          {`${source}\n\n### Three\n\n#### Four\n\n##### Five\n\n###### Six`}
        </MarkdownDocument>
      );

      expect(MARKDOWN_PARTS.filter(part => !container.querySelector(`.doc-${part}`))).toEqual([]);
    });

    it('keeps the class a part already had beside its own', () => {
      const { container } = render(<MarkdownDocument classNames={classNames}>{'- [x] done'}</MarkdownDocument>);

      expect(container.querySelector('ul')?.classList.contains('contains-task-list')).toBe(true);
      expect(container.querySelector('ul')?.classList.contains('doc-list')).toBe(true);
    });

    it('writes no class at all on a part nobody gave one', () => {
      const { container } = render(<MarkdownDocument>{'Plain words.'}</MarkdownDocument>);

      expect(container.querySelector('p')?.hasAttribute('class')).toBe(false);
    });
  });
});
