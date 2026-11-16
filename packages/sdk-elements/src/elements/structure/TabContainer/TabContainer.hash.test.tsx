import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TabContainer } from './TabContainer';
import { TabContainerBody } from './TabContainerBody/TabContainerBody';
import { TabContainerHeader } from './TabContainerHeader/TabContainerHeader';
import { TabContainerItem } from './TabContainerItem/TabContainerItem';
import ElementContext from '../../../Element/ElementContext';
import { elementEntry } from '../../../tests/elementTestUtils';

import type { TabContainerItemProps } from './TabContainerItem/TabContainerItem';
import type { ReactNode } from 'react';

vi.mock('../../../Element/hocs/withElement', () => ({ default: (element: unknown) => element }));

vi.mock('@plitzi/sdk-shared/hooks', async importOriginal => ({
  ...(await importOriginal<typeof import('@plitzi/sdk-shared/hooks')>()),
  usePlitzi: () => ({ settings: { previewMode: true }, root: { baseElementId: 'root' } })
}));

const ref = { current: document.createElement('div') };

/** What the header and the body hand each item through `internalProps`, spread onto it the way `withElement` does. */
const Item = ({
  internalProps,
  hash,
  children
}: {
  internalProps?: Partial<TabContainerItemProps>;
  hash?: string;
  children: ReactNode;
}) => (
  <TabContainerItem ref={ref} className="" {...(hash ? { hash } : {})} {...internalProps}>
    {children}
  </TabContainerItem>
);

const Tabs = () => (
  <ElementContext value={elementEntry('space')}>
    <TabContainer>
      <TabContainerHeader ref={ref} className="">
        <Item hash="overview">Overview</Item>
        <Item hash="domains">Domains</Item>
        <Item>Access</Item>
      </TabContainerHeader>
      <TabContainerBody ref={ref} className="">
        <Item>The space</Item>
        <Item>Its domains</Item>
        <Item>Who may</Item>
      </TabContainerBody>
    </TabContainer>
  </ElementContext>
);

const selected = () =>
  screen.getAllByRole('tab').find(tab => tab.getAttribute('aria-selected') === 'true')?.textContent;

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('TabContainer — a tab the address opens', () => {
  it('opens on the tab whose hash the address carries', () => {
    window.history.replaceState(null, '', '/spaces/7#domains');
    render(<Tabs />);

    expect(selected()).toBe('Domains');
  });

  it('follows the hash when it changes', () => {
    render(<Tabs />);
    expect(selected()).toBe('Overview');

    act(() => {
      window.history.replaceState(null, '', '/spaces/7#domains');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });

    expect(selected()).toBe('Domains');
  });

  it('writes its hash in the address when chosen, never on the first draw, and leaves the history as it was', () => {
    window.history.replaceState(null, '', '/spaces/7?tab=1');
    const length = window.history.length;
    render(<Tabs />);

    expect(window.location.hash).toBe('');

    fireEvent.click(screen.getByRole('tab', { name: 'Domains' }));

    expect(window.location.pathname + window.location.search + window.location.hash).toBe('/spaces/7?tab=1#domains');
    expect(window.history.length).toBe(length);
  });
});
