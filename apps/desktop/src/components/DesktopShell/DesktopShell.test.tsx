import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AuthContext from '@pmodules/auth/AuthContext';
import SpacesContext from '@pmodules/spaces/SpacesContext';

import DesktopShell from './DesktopShell';
import LayoutContext from '../../Layout/LayoutContext';

import type { LayoutContextValue } from '../../Layout/LayoutContext';
import type { AuthContextValue } from '@pmodules/auth/AuthContext';
import type { Space, SpacesContextValue } from '@pmodules/spaces';

/**
 * The window's sidebar, driven the way the window drives it.
 *
 * It is a document now, and a document fails silently: a flow naming an action nobody registered still renders a
 * button, and a binding onto a source out of scope still renders a row — with nothing in it. Neither shows up in a
 * type check or in the validator, so the rail is pressed here rather than looked at.
 */

const space = (id: number, name: string, permanentUrl: string): Space => ({ id, name, permanentUrl });

const logout = vi.fn(() => Promise.resolve());
const reload = vi.fn(() => Promise.resolve());
const toggleSidebar = vi.fn();

const auth = {
  ready: true,
  isAuthenticated: true,
  expired: false,
  user: { id: 1, username: 'carlos', email: 'carlos@plitzi.com' },
  request: vi.fn(),
  signIn: vi.fn(),
  logout,
  can: () => true,
  auth: {}
} as unknown as AuthContextValue;

const spaces = (overrides: Partial<SpacesContextValue> = {}): SpacesContextValue => ({
  owned: [space(1, 'Day Plan', 'day-plan'), space(2, 'Field Guide', 'field-guide')],
  guest: [space(3, 'Acme Site', 'acme-site')],
  loading: false,
  setActiveSpace: vi.fn(),
  getSpace: vi.fn(),
  getWebKey: vi.fn(),
  reload,
  ...overrides
});

const layout = (sidebarVisible = true): LayoutContextValue => ({
  layoutProps: {},
  setLayoutProps: vi.fn(),
  sidebarVisible,
  toggleSidebar
});

const Address = () => <span data-testid="address">{useLocation().pathname}</span>;

/**
 * Whether the SDK is actually showing an element, by the class it hides with.
 *
 * A hidden element stays in the document — `plitzi-component--hidden` is `display: none !important` — so asking
 * the query helpers whether the text is there answers yes either way, and every assertion about a conditional
 * part of the rail passes whatever the condition did.
 */
const shown = (elementId: string): boolean => {
  const node = document.querySelector(`[data-plitzi-el="${elementId}"]`);

  return node !== null && !node.className.includes('plitzi-component--hidden');
};

const mount = (value: SpacesContextValue = spaces(), sidebarVisible = true, at = '/') =>
  render(
    <MemoryRouter initialEntries={[at]}>
      <AuthContext value={auth}>
        <SpacesContext value={value}>
          <LayoutContext value={layout(sidebarVisible)}>
            <DesktopShell />
            <Routes>
              <Route path="*" element={<Address />} />
            </Routes>
          </LayoutContext>
        </SpacesContext>
      </AuthContext>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe('the desktop shell', () => {
  it('lists what the window gave it, in both groups', async () => {
    mount();

    expect(await screen.findByText('Day Plan')).toBeTruthy();
    expect(screen.getByText('Field Guide')).toBeTruthy();
    expect(screen.getByText('Acme Site')).toBeTruthy();
    expect(screen.getByText('SHARED WITH ME')).toBeTruthy();
    expect(screen.getByText('carlos@plitzi.com')).toBeTruthy();
  });

  it('opens a space when its row is pressed', async () => {
    mount();
    await userEvent.click(await screen.findByText('Field Guide'));

    await waitFor(() => expect(screen.getByTestId('address').textContent).toBe('/spaces/view/field-guide'));
  });

  // The half that has to be read from the URL rather than from something the sidebar is told: a window restored
  // onto a deep link is never told, which is what the React sidebar got wrong before it used NavLink.
  it('marks the space in the address as the open one', async () => {
    mount(spaces(), true, '/spaces/view/day-plan');

    const open = (await screen.findByText('Day Plan')).closest('button');

    expect(open?.className).toContain('sh-open');
    expect(screen.getByText('Field Guide').closest('button')?.className).not.toContain('sh-open');
  });

  it('asks the window to refresh, collapse and sign out', async () => {
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Refresh your spaces' }));
    await userEvent.click(screen.getByRole('button', { name: 'Collapse the sidebar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(reload).toHaveBeenCalled();
    expect(toggleSidebar).toHaveBeenCalled();
    await waitFor(() => expect(logout).toHaveBeenCalled());
  });

  it('narrows itself when the window says the sidebar is collapsed', async () => {
    mount(spaces(), false);

    await waitFor(() => expect(document.querySelector('.sh-collapsed')).toBeTruthy());
  });

  it('shows only what there is something to say, when there are spaces', async () => {
    mount();

    await screen.findByText('Day Plan');

    expect(shown('empty-note')).toBe(false);
    expect(shown('loading-note')).toBe(false);
    expect(shown('status')).toBe(false);
    expect(shown('shared-label')).toBe(true);
    expect(shown('foot')).toBe(true);
  });

  /*
    An empty list is TRUTHY, which is why every one of these is published as a boolean the window worked out. Read
    the other way round — `visible: 'host.spaces'` — this message never appears again, and it is the one that has
    to: a window open on a machine with no network shows the same nothing as an account with no spaces.
  */
  it('says the account is empty only when it is', async () => {
    mount(spaces({ owned: [], guest: [] }));

    await waitFor(() => expect(shown('empty-note')).toBe(true));
    expect(shown('shared-label')).toBe(false);
    expect(shown('status')).toBe(false);
  });

  it('says it is offline instead, when that is why the list is empty', async () => {
    mount(spaces({ owned: [], guest: [], error: 'offline' }));

    await waitFor(() => expect(shown('status')).toBe(true));
    expect(screen.getByText(/Offline/)).toBeTruthy();
    expect(shown('empty-note')).toBe(false);
  });

  it('says it is still loading, and says nothing else while it does', async () => {
    mount(spaces({ owned: [], guest: [], loading: true }));

    await waitFor(() => expect(shown('loading-note')).toBe(true));
    expect(shown('empty-note')).toBe(false);
  });
});
