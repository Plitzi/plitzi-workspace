import { runInThisContext } from 'node:vm';

import { act } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NetworkContext } from '@plitzi/sdk-shared/network/react';

import { TabContainer } from './TabContainer';
import { TabContainerBody } from './TabContainerBody/TabContainerBody';
import { TabContainerHeader } from './TabContainerHeader/TabContainerHeader';
import { TabContainerItem } from './TabContainerItem/TabContainerItem';
import ElementContext from '../../../Element/ElementContext';
import { elementEntry } from '../../../tests/elementTestUtils';

import type { TabContainerItemProps } from './TabContainerItem/TabContainerItem';
import type { SSRRenderResult } from '@plitzi/sdk-shared';
import type { NetworkContextValue } from '@plitzi/sdk-shared/network/react';
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

/** What a page server hands the render, by reference: where the page's elements say what it must run before it paints. */
const serverRender = (result: SSRRenderResult) =>
  renderToString(
    // Only what a tab's render reads of the network: the server's render, and where it writes.
    <NetworkContext value={{ server: { ssr: { renderResult: result } } } as unknown as NetworkContextValue}>
      <Tabs />
    </NetworkContext>
  );

afterEach(() => {
  document.body.innerHTML = '';
  window.history.replaceState(null, '', '/');
});

const openTab = () =>
  [...document.querySelectorAll('[role="tab"]')].find(tab => tab.getAttribute('aria-selected') === 'true')?.textContent;

describe('a page drawn by the server, opened on the tab its address names', () => {
  it('shows that tab before React is there, and hydrates on it without a mismatch', async () => {
    window.history.replaceState(null, '', '/spaces/7#domains');
    const result: SSRRenderResult = {};
    document.body.innerHTML = `<div id="plitzi">${serverRender(result)}</div>`;
    expect(openTab()).toBe('Overview');
    expect(Object.keys(result.prePaint ?? {})).toEqual(['tab-hash']);

    // What the page runs as it is parsed, before it paints: the tab's own script, as the render collected it.
    runInThisContext(result.prePaint?.['tab-hash'] ?? '');

    expect(openTab()).toBe('Domains');
    expect([...document.querySelectorAll('[role="tabpanel"]')].map(panel => (panel as HTMLElement).hidden)).toEqual([
      true,
      false,
      true
    ]);

    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await act(async () => {
      hydrateRoot(document.getElementById('plitzi') as HTMLElement, <Tabs />);
      await Promise.resolve();
    });

    expect(openTab()).toBe('Domains');
    expect(errors.mock.calls.filter(([message]) => /hydrat/i.test(String(message)))).toEqual([]);
    errors.mockRestore();
  });
});
