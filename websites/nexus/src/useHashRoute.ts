import { useSyncExternalStore } from 'react';

const subscribe = (onChange: () => void) => {
  window.addEventListener('hashchange', onChange);

  return () => window.removeEventListener('hashchange', onChange);
};

const getSnapshot = () => window.location.hash;

// Tiny hash-based route — GitHub-Pages friendly (no server rewrites). Landing anchors (`#features`) and doc routes
// (`#/docs/...`) share the same hash; `App` tells them apart by the `#/` prefix.
export const useHashRoute = (): string => useSyncExternalStore(subscribe, getSnapshot, () => '');
