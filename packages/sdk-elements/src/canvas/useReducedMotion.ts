import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/**
 * The class the SDK's stylesheet stills a page under (`plitzi-sdk.scss`), put on `<html>` by the dev tools' QA tab: a
 * tester asking for less motion without changing the machine's setting.
 */
const STILLED = 'plitzi-reduced-motion';

const reduced = (): boolean =>
  (typeof window.matchMedia === 'function' && window.matchMedia(QUERY).matches) ||
  document.documentElement.classList.contains(STILLED);

const subscribe = (onChange: () => void): (() => void) => {
  const media = typeof window.matchMedia === 'function' ? window.matchMedia(QUERY) : undefined;
  media?.addEventListener('change', onChange);
  const classes = new MutationObserver(onChange);
  classes.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

  return () => {
    media?.removeEventListener('change', onChange);
    classes.disconnect();
  };
};

/**
 * Whether the visitor asked for less motion: their system's setting, or the QA tab's switch. What the CSS of a space
 * already honours, for the motion a plugin draws itself. False on the server, which draws no motion either way.
 */
const useReducedMotion = (): boolean => useSyncExternalStore(subscribe, reduced, () => false);

export default useReducedMotion;
