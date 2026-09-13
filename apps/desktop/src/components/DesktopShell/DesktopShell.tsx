import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import PlitziSdk from '@plitzi/plitzi-sdk';
import { authorSpace } from '@plitzi/sdk-authoring';
import useAuth from '@pmodules/auth/useAuth';
import useSpaces from '@pmodules/spaces/useSpaces';

import { desktopShell } from './shellSpace';
import useLayout from '../../Layout/useLayout';

import type { Space } from '@pmodules/spaces';

/**
 * Authored once, at module load.
 *
 * The document does not depend on anything that changes while the app runs — everything that does arrives as
 * `hostData` — so authoring it per render would rebuild the same JSON on every keystroke of the window.
 */
const { schema, style } = authorSpace(desktopShell);

const OPEN_SPACE = /^\/spaces\/view\/([^/]+)/;

const toRow = (space: Space) => ({
  id: String(space.id),
  name: space.name,
  url: space.permanentUrl,
  initial: space.name.slice(0, 1)
});

/**
 * The window's sidebar — a Plitzi space, rendered offline, driven by this window.
 *
 * The rail used to be React: a nav, a header, a footer and a `collapsed` flag through all three. What it does is
 * list what it is given and ask for something to happen, which is what a space is for, so it IS one now — see
 * `./desktopShell`. This component is the two halves a document cannot have: the data, and the doing.
 *
 * **Every either/or is published as a BOOLEAN.** A binding writes only truthy, boolean and number values, so a
 * space asking `visible: 'host.status'` about a string that is sometimes empty gets an element that never hides
 * again. The host is the side that knows, so the host decides and says so plainly.
 */
const DesktopShell = () => {
  const { user, logout } = useAuth();
  const { owned, guest, loading, error, reload } = useSpaces();
  const { sidebarVisible, toggleSidebar } = useLayout();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const collapsed = !sidebarVisible;
  const empty = owned.length === 0 && guest.length === 0;

  const hostData = useMemo(
    () => ({
      collapsed,
      // Both names in full rather than a modifier that is sometimes empty: an empty string is not written, so the
      // arrow would keep whichever direction it last had.
      collapseIcon: collapsed ? 'fa-solid fa-angles-right' : 'fa-solid fa-angles-left',
      collapseLabel: collapsed ? 'Expand the sidebar' : 'Collapse the sidebar',
      /**
       * Which space is open, read from the URL.
       *
       * The URL and not an `activeSpace` the sidebar is told about: a window restored onto a deep link is never
       * told, and that is exactly the case the 2023 sidebar got wrong.
       */
      openSpace: OPEN_SPACE.exec(pathname)?.[1] ?? '',
      spaces: owned.map(toRow),
      guestSpaces: guest.map(toRow),
      hasGuests: guest.length > 0,
      loading: loading && empty,
      empty: !loading && error === undefined && empty,
      hasStatus: error !== undefined,
      status: error === 'offline' ? 'Offline — showing the list from last time' : (error ?? ''),
      statusClass: error === 'offline' ? 'sh-status sh-status-offline' : 'sh-status sh-status-error',
      signedIn: user !== undefined,
      user: { name: user?.username ?? '', email: user?.email ?? '', initial: user?.username.slice(0, 1) ?? '' }
    }),
    [collapsed, pathname, owned, guest, loading, error, empty, user]
  );

  const openSpace = useCallback(
    (params: Record<string, unknown>) => void navigate(`/spaces/view/${String(params.value)}`),
    [navigate]
  );

  const home = useCallback(() => void navigate('/'), [navigate]);

  const refresh = useCallback(() => void reload(), [reload]);

  const signOut = useCallback(async () => {
    await logout();
    await navigate('/');
  }, [logout, navigate]);

  const hostActions = useMemo(
    () => ({ openSpace, home, refresh, toggleSidebar, signOut: () => void signOut() }),
    [openSpace, home, refresh, toggleSidebar, signOut]
  );

  return (
    <PlitziSdk
      offlineMode
      offlineData={{ schema, style }}
      // The window has a router of its own and this space has one page, so the address bar is none of its
      // business — with the browser router the rail would rewrite the location the moment it mounted.
      routing="memory"
      renderMode="raw"
      branding={false}
      // The rail is the window's chrome: it follows the window's theme and never writes to it. See PlitziSdkWrapper.
      themeScope="container"

      previewMode
      hostData={hostData}
      hostActions={hostActions}
    />
  );
};

export default DesktopShell;
