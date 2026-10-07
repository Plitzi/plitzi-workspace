import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CURRENT_SELECTOR } from '@plitzi/sdk-shared/style/styleStates';

import { TabContainer } from './TabContainer';
import { TabContainerBody } from './TabContainerBody/TabContainerBody';
import { TabContainerHeader } from './TabContainerHeader/TabContainerHeader';
import { TabContainerItem } from './TabContainerItem/TabContainerItem';
import ElementContext from '../../../Element/ElementContext';
import { elementEntry } from '../../../testUtils/elementTestUtils';

import type { TabContainerItemProps } from './TabContainerItem/TabContainerItem';
import type { ReactNode } from 'react';

vi.mock('../../../Element/hocs/withElement', () => ({ default: (element: unknown) => element }));

vi.mock('@plitzi/sdk-shared/hooks/usePlitziServiceContext', () => ({
  default: () => ({ settings: { previewMode: true }, root: { baseElementId: 'root' }, contexts: {} })
}));

const ref = { current: document.createElement('div') };

/** What the header and the body hand each item through `internalProps`, spread onto it the way `withElement` does. */
const Item = ({ internalProps, children }: { internalProps?: Partial<TabContainerItemProps>; children: ReactNode }) => (
  <TabContainerItem ref={ref} className="" {...internalProps}>
    {children}
  </TabContainerItem>
);

const Tabs = () => (
  <ElementContext value={elementEntry('plans')}>
    <TabContainer>
      <TabContainerHeader ref={ref} className="">
        <Item>Monthly</Item>
        <Item>Yearly</Item>
        <Item>Lifetime</Item>
      </TabContainerHeader>
      <TabContainerBody ref={ref} className="">
        <Item>12 € a month</Item>
        <Item>120 € a year</Item>
        <Item>Once, 300 €</Item>
      </TabContainerBody>
    </TabContainer>
  </ElementContext>
);

describe('TabContainer — a tab list assistive technology can read and work', () => {
  it('is a tab list whose selected tab names the panel it shows', () => {
    render(<Tabs />);

    const [monthly, yearly] = screen.getAllByRole('tab');
    const panel = screen.getByRole('tabpanel', { name: 'Monthly', hidden: true });

    expect(screen.getByRole('tablist')).toBeTruthy();
    expect(monthly.getAttribute('aria-selected')).toBe('true');
    expect(monthly.getAttribute('tabindex')).toBe('0');
    expect(yearly.getAttribute('aria-selected')).toBe('false');
    expect(yearly.getAttribute('tabindex')).toBe('-1');
    expect(monthly.getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.textContent).toBe('12 € a month');
  });

  it('moves the selection and the focus with the arrow keys, round the ends', () => {
    render(<Tabs />);
    const [monthly] = screen.getAllByRole('tab');
    monthly.focus();

    fireEvent.keyDown(monthly, { key: 'ArrowLeft' });

    const lifetime = screen.getByRole('tab', { name: 'Lifetime' });

    expect(lifetime.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(lifetime);

    fireEvent.keyDown(lifetime, { key: 'Home' });

    expect(screen.getByRole('tab', { name: 'Monthly' }).getAttribute('aria-selected')).toBe('true');
  });

  it('hides the panels not on show, so only the one on show is in the `current` state', () => {
    render(<Tabs />);

    const panels = screen.getAllByRole('tabpanel', { hidden: true });

    expect(panels.map(panel => panel.hidden)).toEqual([false, true, true]);
    expect(screen.getAllByRole('tabpanel').map(panel => panel.textContent)).toEqual(['12 € a month']);
    expect(panels.map(panel => panel.matches(CURRENT_SELECTOR))).toEqual([true, false, false]);

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Monthly' }), { key: 'End' });

    expect(panels.map(panel => panel.hidden)).toEqual([true, true, false]);
  });

  it('selects with Enter or Space, as a click does', () => {
    render(<Tabs />);

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Yearly' }), { key: 'Enter' });

    expect(screen.getByRole('tab', { name: 'Yearly' }).getAttribute('aria-selected')).toBe('true');
  });
});
