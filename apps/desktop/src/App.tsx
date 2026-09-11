import { ModalProvider } from '@plitzi/plitzi-ui/Modal';
import { ToastProvider } from '@plitzi/plitzi-ui/Toast';
import { useMemo } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';

import { ThemeProvider } from '@plitzi/sdk-shared';

import AppContext from './AppContext';
import { getEnvironmentServer, resolveEnvironment } from './config/environments';
import Layout, { LayoutProvider } from './Layout';
import AuthProvider from './modules/auth/AuthProvider';
import SignInScreen from './modules/auth/SignInScreen';
import useAuth from './modules/auth/useAuth';
import { createApiClient } from './modules/network';
import SiteNotFoundPage from './modules/site/pages/SiteNotFoundPage';
import SpaceRoutes from './modules/spaces/SpaceRoutes';
import SpacesProvider from './modules/spaces/SpacesProvider';

import type { AppContextValue } from './AppContext';
import type { ApiClient } from './modules/network';

/**
 * What the window shows, once it knows who is at it.
 *
 * `ready` is the whole reason this is a component of its own: the stored session is read asynchronously, and a
 * router that renders before the answer mounts the sign-in screen and then replaces it — which on a machine that
 * signs in every morning is a flash of the wrong screen on every launch.
 *
 * There is no `/auth/*` any more. Signing in, signing up, resetting a password and confirming an address all
 * happen on the platform's own screen in the browser; this window has one button and the session it comes back
 * with. The links in those emails open the browser, which is where they always belonged.
 */
const AppRoutes = () => {
  const { ready, isAuthenticated } = useAuth();

  if (!ready) {
    return null;
  }

  return (
    <Layout>
      <Routes>
        {!isAuthenticated && <Route path="/" element={<SignInScreen />} />}
        {isAuthenticated && <Route path="/" element={<Navigate replace to="/spaces" />} />}
        {isAuthenticated && <Route path="/spaces/*" element={<SpaceRoutes />} />}
        <Route path="/404" element={<SiteNotFoundPage />} />
        <Route path="*" element={<Navigate replace to={isAuthenticated ? '/404' : '/'} />} />
      </Routes>
    </Layout>
  );
};

export type AppProps = {
  /** Overridden in tests and by whoever is pointing this window at a branch. */
  api?: ApiClient;
};

const App = ({ api }: AppProps) => {
  const environment = useMemo(
    () => resolveEnvironment(import.meta.env.VITE_PLITZI_DESKTOP_ENV, import.meta.env.DEV),
    []
  );
  const app = useMemo<AppContextValue>(() => ({ environment, ...getEnvironmentServer(environment) }), [environment]);
  const client = useMemo(() => api ?? createApiClient({ baseUrl: app.apiServer }), [api, app.apiServer]);

  /**
   * `HashRouter`, still, and for the reason it was chosen in 2023: a packaged window serves its renderer from a
   * bundle, so a path route reloaded at `/spaces/view/x` asks the shell for a file that does not exist. The
   * protocol handler answers `index.html` for exactly that case, but the hash costs nothing and keeps a `file://`
   * build — which is what a `vite preview` of this is — working too.
   */
  return (
    <AppContext value={app}>
      {/*
       * The WINDOW's theme, which is not any space's.
       *
       * Every space this window renders is mounted with `themeScope="container"`, so none of them writes the
       * document class the chrome is drawn against — this does, and it is the only thing that does. `system` by
       * default because a desktop application that ignores the machine it was installed on looks broken next to
       * every other window on the screen.
       */}
      <ThemeProvider defaultTheme="system" cookieName="plitzi-desktop-theme">
        <AuthProvider api={client}>
          <SpacesProvider>
            <LayoutProvider>
              <ToastProvider>
                <ModalProvider>
                  <HashRouter>
                    <AppRoutes />
                  </HashRouter>
                </ModalProvider>
              </ToastProvider>
            </LayoutProvider>
          </SpacesProvider>
        </AuthProvider>
      </ThemeProvider>
    </AppContext>
  );
};

export default App;
