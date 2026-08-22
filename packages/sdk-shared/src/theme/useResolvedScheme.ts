import { useSyncExternalStore } from 'react';

import type { ColorScheme, Theme } from '../types';

const DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * What the machine is asking for, as a store React can subscribe to.
 *
 * One implementation for the whole SDK. A component that runs its own `matchMedia` gets a value that stops
 * updating the moment the visitor changes their system setting, and no two of them agree during the frame in
 * between — which is how a panel ends up dark inside a page that is still light.
 */
const subscribe = (onChange: () => void) => {
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener('change', onChange);

  return () => query.removeEventListener('change', onChange);
};

const snapshot = (): ColorScheme => (window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light');

/** There is no machine on the server. Light is the assumption the CSS itself makes before a query answers. */
const serverSnapshot = (): ColorScheme => 'light';

/**
 * A theme mode with `system` already answered — and kept answered when the machine changes its mind.
 *
 * Anything that PAINTS wants this: a code editor, a chart, the dev-tools panel, the builder's canvas. `system` is
 * not a colour and cannot be compared against one, and resolving it to `light` (the usual shortcut) makes a
 * dark-set machine render the light thing.
 */
export const useResolvedScheme = (mode: Theme): ColorScheme => {
  const machine = useSyncExternalStore(subscribe, snapshot, serverSnapshot);

  return mode === 'system' ? machine : mode;
};

export default useResolvedScheme;
