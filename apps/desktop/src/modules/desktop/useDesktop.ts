import { useMemo } from 'react';

import type { DesktopBridge } from './bridge';

declare global {
  interface Window {
    plitziDesktop?: DesktopBridge;
  }
}

const SESSION_KEY = 'plitzi-desktop.session';

/**
 * `sessionStorage`, if this browser has one to give.
 *
 * A private window and a browser configured to block site data both throw on the accessor itself rather than
 * answering null, so every use of it is guarded — and a `catch` that returns nothing is right, because the whole
 * fallback is a convenience for a context that has no keyring anyway.
 */
const webStorage = (): Storage | undefined => {
  try {
    return typeof sessionStorage === 'undefined' ? undefined : sessionStorage;
  } catch {
    return undefined;
  }
};

/**
 * A browser-shaped stand-in for the preload bridge.
 *
 * The renderer is an ordinary web app, and it runs as one in the test suite and in `vite dev` before Electron has
 * attached — so every call site would otherwise need to know that `window.plitziDesktop` might not be there. The
 * session goes to `sessionStorage` in that case rather than `localStorage`: outside Electron there is no keyring
 * to protect it, so it must not outlive the tab.
 */
const fallback: DesktopBridge = {
  platform: 'browser' as NodeJS.Platform,
  version: '0.0.0-web',
  readSession: () => Promise.resolve(webStorage()?.getItem(SESSION_KEY) ?? undefined),
  writeSession: value => {
    webStorage()?.setItem(SESSION_KEY, value);

    return Promise.resolve();
  },
  clearSession: () => {
    webStorage()?.removeItem(SESSION_KEY);

    return Promise.resolve();
  }
};

const bridge = (): DesktopBridge | undefined => (typeof window === 'undefined' ? undefined : window.plitziDesktop);

export const useDesktop = (): DesktopBridge => useMemo(() => bridge() ?? fallback, []);

export const isDesktop = (): boolean => bridge() !== undefined;

export default useDesktop;
