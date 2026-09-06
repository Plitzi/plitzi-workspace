import { ModalProvider } from '@plitzi/plitzi-ui/Modal';
import { ToastProvider } from '@plitzi/plitzi-ui/Toast';
import { useMemo } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';

import AppContext from './AppContext';
import { getEnvironmentServer, resolveEnvironment } from './config/environments';
import Layout, { LayoutProvider } from './Layout';
import AuthProvider from './modules/auth/AuthProvider';
import AuthRoutes from './modules/auth/AuthRoutes';
import LoginPage from './modules/auth/pages/LoginPage';
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
 */
const AppRoutes = () => {
  const { ready, isAuthenticated } = useAuth();

  if (!ready) {
    return null;
  }

  return (
    <Layout>
      <Routes>
        {!isAuthenticated && <Route path="/" element={<LoginPage />} />}
        {isAuthenticated && <Route path="/" element={<Navigate replace to="/spaces" />} />}
        <Route path="/auth/*" element={<AuthRoutes />} />
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
      <AuthProvider api={client}>
        <SpacesProvider api={client}>
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
    </AppContext>
  );
};

export default App;
