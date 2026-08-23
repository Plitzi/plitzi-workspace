import { use, useCallback } from 'react';

import { ThemeContext } from '@plitzi/sdk-shared/theme/ThemeProvider';

import DevToolsButton from './DevToolsButton';

import type { Theme } from '@plitzi/sdk-shared';

// `system` is a real answer in the cycle, not the absence of an override.
const NEXT: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' };

const ICON: Record<Theme, string> = {
  system: 'fa-solid fa-desktop',
  light: 'fa-solid fa-sun',
  dark: 'fa-solid fa-moon'
};

const LABEL: Record<Theme, string> = { system: 'System', light: 'Light', dark: 'Dark' };

// Writes the SDK's shared theme context, so the document root, the palette rules and this panel all follow one value.
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
