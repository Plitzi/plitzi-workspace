import { useEffect } from 'react';

import LayoutEmpty from './intents/LayoutEmpty';
import LayoutMain from './intents/LayoutMain';
import useLayout from './useLayout';

import type { LayoutProps } from './LayoutContext';
import type { ReactNode } from 'react';

export type LayoutComponentProps = LayoutProps & { children?: ReactNode };

/**
 * The document title, which on the desktop is the window title.
 *
 * The 2023 build did this through `react-helmet-async`, a whole rendering layer for one string — and one that
 * also carried the Google Analytics tag, which has no business in a desktop client at all.
 */
const useWindowTitle = (title: string | undefined): void => {
  useEffect(() => {
    document.title = title ? `${title} — Plitzi` : 'Plitzi';
  }, [title]);
};

const Layout = ({ children, ...props }: LayoutComponentProps) => {
  const { layoutProps } = useLayout();
  const { intent = 'main', title, ...rest } = { ...props, ...layoutProps };
  useWindowTitle(title);

  if (intent === 'empty') {
    return <LayoutEmpty {...rest}>{children}</LayoutEmpty>;
  }

  return <LayoutMain {...rest}>{children}</LayoutMain>;
};

export default Layout;
