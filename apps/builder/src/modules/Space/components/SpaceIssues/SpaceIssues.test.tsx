import { render } from '@testing-library/react';
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
    const { getByText } = render(<SpaceIssues issues={{ errors: [], warnings: [] }} onNavigate={vi.fn()} />);

    expect(getByText('Nothing wrong with the saved space.')).toBeTruthy();
  });

  it('lists what stops a publish before what only asks to be looked at, each group counted', () => {
    const { getAllByRole } = render(
      <SpaceIssues
        intro="Fix these first"
        issues={{
          errors: [{ code: 'a', message: 'Broken', elementId: null }],
          warnings: [
            { code: 'b', message: 'Odd', elementId: null },
            { code: 'c', message: 'Odder', elementId: null }
          ]
        }}
        onNavigate={vi.fn()}
      />
    );

    expect(getAllByRole('heading').map(heading => heading.textContent)).toEqual(['Errors · 1', 'Warnings · 2']);
  });
});
