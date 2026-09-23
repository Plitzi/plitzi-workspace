import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { useBuilderStore } from '@plitzi/sdk-shared/store';
import useRevealElement from '@pmodules/Builder/hooks/useRevealElement';

import IssueItem from './IssueItem';

import type { Element } from '@plitzi/sdk-shared';

vi.mock('@plitzi/sdk-shared/store', () => ({ useBuilderStore: vi.fn() }));
vi.mock('@pmodules/Builder/hooks/useRevealElement', () => ({ default: vi.fn() }));

const element = (id: string, parentId?: string): Element => ({
  id,
  attributes: {},
  definition: { rootId: 'home', parentId, label: id, type: 'text', items: [], styleSelectors: { base: '' } }
});

const flat = { home: element('home'), box: element('box', 'home'), hello: element('hello', 'box') };
const reveal = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useBuilderStore).mockReturnValue([flat] as unknown as ReturnType<typeof useBuilderStore>);
  vi.mocked(useRevealElement).mockReturnValue(reveal);
});

describe('IssueItem', () => {
  it('takes someone to the element the issue names, and gets out of the way', () => {
    const onNavigate = vi.fn();
    const { getByText } = render(
      <IssueItem
        issue={{ code: 'binding-target-unknown', message: 'Lands on nothing', elementId: 'hello' }}
        severity="error"
        onNavigate={onNavigate}
      />
    );

    fireEvent.click(getByText('hello'));

    expect(reveal).toHaveBeenCalledWith({ id: 'hello', rootId: 'home', ancestors: ['home', 'box'] });
    expect(onNavigate).toHaveBeenCalled();
  });

  // Deleted since the save the list was read from: there is nothing left to take anyone to.
  it('names an element that is gone without linking it', () => {
    const { getByText, queryByRole } = render(
      <IssueItem
        issue={{ code: 'binding-target-unknown', message: 'Lands on nothing', elementId: 'gone' }}
        severity="error"
        onNavigate={vi.fn()}
      />
    );

    expect(getByText('gone')).toBeTruthy();
    expect(queryByRole('button')).toBeNull();
  });

  it('shows an issue about the whole space with no element at all', () => {
    const { getByText, queryByRole } = render(
      <IssueItem
        issue={{ code: 'colour-without-dark', message: 'No dark value', elementId: null }}
        severity="warning"
        onNavigate={vi.fn()}
      />
    );

    expect(getByText('No dark value')).toBeTruthy();
    expect(queryByRole('button')).toBeNull();
  });
});
