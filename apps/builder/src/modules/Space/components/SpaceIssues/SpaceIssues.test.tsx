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

  it('lists the shorter ways after the problems: the short way, what it saves, and the elements it is about', () => {
    const { getByText } = render(
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
    expect(getByText('Suggestions · 1')).toBeTruthy();
    expect(getByText('The short way:')).toBeTruthy();
    expect(getByText('Saves 35 elements')).toBeTruthy();
    expect(getByText('d')).toBeTruthy();
    expect(getByText('and 2 more')).toBeTruthy();
  });

  it('lists what stops a publish before what only asks to be looked at, each group counted', () => {
    const { getAllByRole } = render(
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

    expect(getAllByRole('heading').map(heading => heading.textContent)).toEqual(['Errors · 1', 'Warnings · 2']);
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
