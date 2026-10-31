// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useBuilderStore } from '@plitzi/sdk-shared/store';

import AppDirectory from './AppDirectory';

import type { DirectoryProps } from './Directory';

vi.mock('@plitzi/sdk-shared/store', () => ({ useBuilderStore: vi.fn() }));
vi.mock('@pmodules/Network/hooks/useBuilderNetwork', () => ({ default: () => ({ webId: 7 }) }));
vi.mock('./DirectoryHeader', () => ({ default: () => null }));
// The tree as the panel asks it: whether the root and a folder of it are shown open.
vi.mock('./Directory', () => ({
  default: ({ isCollapsed }: DirectoryProps) => (
    <>
      <p>root {isCollapsed?.('') ? 'closed' : 'open'}</p>
      <p>folder {isCollapsed?.('blog') ? 'closed' : 'open'}</p>
    </>
  )
}));

describe('AppDirectory', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(useBuilderStore).mockImplementation((() => [[{}, [], '']]) as unknown as typeof useBuilderStore);
  });

  it('opens on the root, which holds every page, and keeps every other folder closed', async () => {
    render(<AppDirectory />);

    expect(await screen.findByText('root open')).toBeTruthy();
    expect(await screen.findByText('folder closed')).toBeTruthy();
  });

  it('keeps the root closed once it was closed', async () => {
    localStorage.setItem('builder-state', JSON.stringify({ pageFolders: { collapsedCache: { '7:root': true } } }));
    render(<AppDirectory />);

    expect(await screen.findByText('root closed')).toBeTruthy();
  });
});
