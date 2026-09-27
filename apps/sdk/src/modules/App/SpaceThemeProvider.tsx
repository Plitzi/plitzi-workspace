import { ThemeProvider } from '@plitzi/sdk-shared';
import { useSdkStore } from '@plitzi/sdk-shared/store';

import type { ThemeScope } from '@plitzi/sdk-shared';
import type { Theme } from '@plitzi/sdk-shared/types';
import type { ReactNode } from 'react';

export type SpaceThemeProviderProps = {
  scope: ThemeScope;
  /** A theme the host already settled — the cookie a server read — which wins over everything here. */
  theme?: Theme;
  children?: ReactNode;
};

/**
 * The theme provider, starting where the SPACE says to start.
 *
 * `style.theme.default` is what a space declares a first visit looks like; the provider was mounted with a hard-coded
 * `system`, so the setting was stored, edited in the builder and written by authoring, and never rendered. It is read
 * from the store because a space fetched after mount arrives there late — the provider re-applies its default when
 * it does, and a visitor's own choice (the cookie) still wins.
 */
const SpaceThemeProvider = ({ scope, theme, children }: SpaceThemeProviderProps) => {
  // Absent until the space is in the store — and in a style document written before themes existed.
  const [[spaceDefault = 'system']] = useSdkStore(['style.theme.default']);

  return (
    <ThemeProvider defaultTheme={spaceDefault} scope={scope} theme={theme}>
      {children}
    </ThemeProvider>
  );
};

export default SpaceThemeProvider;
