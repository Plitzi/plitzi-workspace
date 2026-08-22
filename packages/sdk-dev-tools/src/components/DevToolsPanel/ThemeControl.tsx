import { use, useCallback } from 'react';

import { ThemeContext } from '@plitzi/sdk-shared/theme/ThemeProvider';

import DevToolsButton from './DevToolsButton';

import type { Theme } from '@plitzi/sdk-shared';

/**
 * Three answers in one button: the machine's, and the two ways of overruling it.
 *
 * `system` is a real answer rather than the absence of one, so it gets a place in the cycle instead of being
 * something you can only get back by clearing storage.
 */
const NEXT: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' };

const ICON: Record<Theme, string> = {
  system: 'fa-solid fa-desktop',
  light: 'fa-solid fa-sun',
  dark: 'fa-solid fa-moon'
};

const LABEL: Record<Theme, string> = { system: 'System', light: 'Light', dark: 'Dark' };

/**
 * The scheme, where every space that has the dev tools can reach it.
 *
 * It writes to the same context the rest of the SDK reads — the class on the document root, the palette's own
 * `prefers-color-scheme` rules, and this panel's own colours all follow the one value. So a space needs to author
 * a switch only if its VISITORS should have one; while building it, this is the switch.
 */
const ThemeControl = () => {
  const { theme, setTheme } = use(ThemeContext);

  const handleClick = useCallback(() => setTheme(NEXT[theme]), [theme, setTheme]);

  return (
    <DevToolsButton
      iconClassName={ICON[theme]}
      title={`Theme: ${LABEL[theme]} — click for ${LABEL[NEXT[theme]]}`}
      onClick={handleClick}
    />
  );
};

export default ThemeControl;
