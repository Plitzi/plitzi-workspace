import { fireEvent, render, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useBuilderStore } from '@plitzi/sdk-shared/store';
import useRevealElement from '@pmodules/Builder/hooks/useRevealElement';

import History from './History';
import useSpaceChanges from './hooks/useSpaceChanges';

import type { ChangeRecord } from './helpers';

vi.mock('./hooks/useSpaceChanges', () => ({ default: vi.fn() }));
vi.mock('@plitzi/sdk-shared/store', () => ({ useBuilderStore: vi.fn() }));
vi.mock('@pmodules/Builder/hooks/useRevealElement', () => ({ default: vi.fn() }));
vi.mock('@pmodules/Builder/helpers/elementChain', () => ({ chainOf: () => ({ rootId: 'home', ancestors: ['home'] }) }));

const reveal = vi.fn();

const agentEdit: ChangeRecord = {
  seq: 2,
  at: Date.UTC(2026, 8, 23, 12),
  document: 'schema',
  author: { userId: 1, name: 'Ana' },
  origin: 'mcp',
  batch: 'apply-1',
  summary: 'Updated element hero',
  entries: [
    {
      kind: 'element',
      id: 'hero',
      op: 'update',
      before: { attributes: { content: 'Hi' } },
      after: { attributes: { content: 'Hello' } }
    }
  ]
};

const personEdit: ChangeRecord = {
  ...agentEdit,
  seq: 1,
  at: Date.UTC(2026, 8, 22, 12),
  origin: 'builder',
  client: 'tab-1',
  batch: 'request-1',
  summary: 'Added element card',
  entries: [{ kind: 'element', id: 'card', op: 'add', after: {} }]
};

const timeline = (overrides: Partial<ReturnType<typeof useSpaceChanges>> = {}) =>
  vi.mocked(useSpaceChanges).mockReturnValue({
    changes: [agentEdit, personEdit],
    snapshots: [
      { revision: 4, environment: 'main', description: 'Launch', publishedAt: Date.UTC(2026, 8, 23), upToSeq: 1 }
    ],
    complete: true,
    loading: false,
    error: undefined,
    loadMore: vi.fn(),
    refresh: vi.fn(),
    ...overrides
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useRevealElement).mockReturnValue(reveal);
  // Only the two keys the panel reads: the selected element, and the flat map a link checks the element against.
  vi.mocked(useBuilderStore).mockImplementation(((key: string) =>
    key === 'schema.flat' ? [{ hero: {} }] : ['hero']) as unknown as typeof useBuilderStore);
  timeline();
});

describe('History', () => {
  it('lists who changed what, newest first, with a published revision marked between the changes it splits', () => {
    const { container, getByRole, getByText } = render(<History />);
    const text = container.textContent;

    expect(within(getByRole('list')).getByText('Agent')).toBeTruthy();
    expect(getByText('Changed content of element “hero”')).toBeTruthy();
    expect(getByText('Revision 4 · “Launch” · includes up to #1')).toBeTruthy();
    expect(within(getByRole('list')).getByText('#2')).toBeTruthy();
    expect(text.indexOf('Changed content of element “hero”')).toBeLessThan(text.indexOf('Revision 4'));
    expect(text.indexOf('Revision 4')).toBeLessThan(text.indexOf('Added element “card”'));
  });

  it('unfolds a change into each field before and after, and takes someone to the element it touched', () => {
    const { getByText } = render(<History />);

    fireEvent.click(getByText('Changed content of element “hero”'));

    expect(getByText('attributes.content')).toBeTruthy();
    expect(getByText('"Hi"')).toBeTruthy();
    expect(getByText('"Hello"')).toBeTruthy();

    fireEvent.click(getByText('hero'));

    expect(reveal).toHaveBeenCalledWith({ id: 'hero', rootId: 'home', ancestors: ['home'] });
  });

  it('asks for one element’s history when told to, and says so when there is nothing yet', () => {
    timeline({ changes: [], snapshots: [] });
    const { getByLabelText, getByText } = render(<History />);

    fireEvent.click(getByLabelText('Only the selected element'));

    expect(vi.mocked(useSpaceChanges)).toHaveBeenLastCalledWith({ entityId: 'hero' });
    expect(getByText(/Nothing recorded yet/)).toBeTruthy();
  });
});
