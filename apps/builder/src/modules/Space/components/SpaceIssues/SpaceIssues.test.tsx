import { fireEvent, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { useBuilderStore } from '@plitzi/sdk-shared/store';

import SpaceIssues from './SpaceIssues';

vi.mock('@plitzi/sdk-shared/store', () => ({ useBuilderStore: vi.fn() }));
vi.mock('@pmodules/Builder/hooks/useRevealElement', () => ({ default: () => vi.fn() }));

beforeEach(() => {
  vi.mocked(useBuilderStore).mockReturnValue([{}] as unknown as ReturnType<typeof useBuilderStore>);
});

describe('SpaceIssues', () => {
  it('says so when there is nothing wrong', () => {
    const { getByText } = render(
      <SpaceIssues issues={{ errors: [], warnings: [], suggestions: [] }} onDismiss={vi.fn()} />
    );

    expect(getByText('Nothing wrong with the saved space.')).toBeTruthy();
  });

  it('lists the shorter ways: the short way once, what each saves, and the elements it is about', () => {
    const { getByText, getAllByRole } = render(
      <SpaceIssues
        issues={{
          errors: [],
          warnings: [],
          suggestions: [
            {
              code: 'repeated-on-pages',
              message: '6 pages carry the same header',
              elementIds: ['a', 'b', 'c', 'd', 'e', 'f'],
              saves: 35,
              fix: 'a `layout` holding it once'
            }
          ]
        }}
        onDismiss={vi.fn()}
      />
    );

    expect(getByText('Nothing wrong with the saved space.')).toBeTruthy();
    expect(getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Suggestions1']);
    // A list of one code has nothing to choose between: it starts unfolded.
    expect(getByText('Repeated on pages')).toBeTruthy();
    expect(getByText('The short way:')).toBeTruthy();
    expect(getByText('Saves 35 elements')).toBeTruthy();
    expect(getByText('d')).toBeTruthy();
    expect(getByText('and 2 more')).toBeTruthy();
  });

  it('puts each list in a tab, what stops a publish first, each counted', () => {
    const { getAllByRole, getByText, queryByText } = render(
      <SpaceIssues
        intro="Fix these first"
        issues={{
          errors: [{ code: 'a', message: 'Broken', elementId: null, fixable: false, fix: null }],
          warnings: [
            { code: 'b', message: 'Odd', elementId: null, fixable: false, fix: null },
            { code: 'c', message: 'Odder', elementId: null, fixable: false, fix: null }
          ],
          suggestions: []
        }}
        onDismiss={vi.fn()}
      />
    );

    expect(getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Errors1', 'Warnings2']);
    expect(getByText('Broken')).toBeTruthy();
    expect(queryByText('Odd')).toBeNull();

    fireEvent.click(getByText('Warnings'));

    expect(queryByText('Broken')).toBeNull();
    expect(getByText('B')).toBeTruthy();
    expect(getByText('C')).toBeTruthy();
  });

  // Seventeen suggestions of three kinds read as three lines, not as seventeen paragraphs: the long list was unreadable.
  it('folds a list of several codes to a line each, and says what to do once per code', () => {
    const shape = (id: string) => ({
      code: 'repeated-shape',
      message: `Containers like "${id}" are one item written again`,
      elementIds: [id],
      saves: 10,
      fix: 'one `list` over the rows'
    });
    const { getByText, queryByText, getAllByText } = render(
      <SpaceIssues
        issues={{
          errors: [],
          warnings: [],
          suggestions: [
            shape('one'),
            shape('two'),
            { code: 'desktop-only', message: 'Too wide', elementIds: ['wide'], saves: 0, fix: 'a `mobile` rule' }
          ]
        }}
        onDismiss={vi.fn()}
      />
    );

    expect(getByText('Repeated shape')).toBeTruthy();
    expect(getByText('saves 20')).toBeTruthy();
    expect(getByText('Desktop only')).toBeTruthy();
    expect(queryByText(/Containers like/)).toBeNull();

    fireEvent.click(getByText('Repeated shape'));

    expect(getAllByText(/Containers like/)).toHaveLength(2);
    expect(getAllByText('The short way:')).toHaveLength(1);
    expect(getByText('list').tagName).toBe('CODE');
  });

  it('cuts a long message to three lines until asked for the rest', () => {
    const long = `${'A paragraph that names every element. '.repeat(10)}End.`;
    const { getByText } = render(
      <SpaceIssues
        issues={{
          errors: [],
          warnings: [{ code: 'w', message: long, elementId: null, fixable: false, fix: null }],
          suggestions: []
        }}
        onDismiss={vi.fn()}
      />
    );

    expect(getByText(/End\./).className).toContain('line-clamp-3');

    fireEvent.click(getByText('Show more'));

    expect(getByText(/End\./).className).not.toContain('line-clamp-3');
    expect(getByText('Show less')).toBeTruthy();
  });

  it('offers to fix what has one reading, then gets out of the way', async () => {
    const onFix = vi.fn(() => Promise.resolve());
    const onDismiss = vi.fn();
    const { getByText } = render(
      <SpaceIssues
        issues={{
          errors: [
            { code: 'page-target-url', message: 'A URL in page mode', elementId: null, fixable: true, fix: null },
            { code: 'template-unreadable', message: 'Cannot be read', elementId: null, fixable: false, fix: null }
          ],
          warnings: [],
          suggestions: []
        }}
        onDismiss={onDismiss}
        onFix={onFix}
      />
    );

    fireEvent.click(getByText('Fix 1 automatically'));

    expect(onFix).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onDismiss).toHaveBeenCalledTimes(1));
  });

  it('offers nothing when nothing has one reading', () => {
    const { queryByText } = render(
      <SpaceIssues
        issues={{
          errors: [{ code: 'x', message: 'Needs a person', elementId: null, fixable: false, fix: null }],
          warnings: [],
          suggestions: []
        }}
        onDismiss={vi.fn()}
        onFix={vi.fn(() => Promise.resolve())}
      />
    );

    expect(queryByText(/automatically/)).toBeNull();
  });
});
