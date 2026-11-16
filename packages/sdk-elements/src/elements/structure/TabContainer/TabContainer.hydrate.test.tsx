import { readFileSync } from 'node:fs';
import path from 'node:path';
import { runInThisContext } from 'node:vm';

import { act } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
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

/**
 * The page's script that opens the tab its address names before React is there (sdk-server's template, `tabHash.js`):
 * read from where the page server keeps it, since the two halves — it, and the container hydrating on what it opened —
 * are one contract.
 */
const TAB_HASH = readFileSync(
  path.resolve(process.cwd(), '../../apps/server/src/modules/ssr/views/inline/tabHash.js'),
  'utf8'
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
    document.body.innerHTML = `<div id="plitzi">${renderToString(<Tabs />)}</div>`;
    expect(openTab()).toBe('Overview');

    // As the browser runs it, parsed after the page and before it paints.
    runInThisContext(TAB_HASH);

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
