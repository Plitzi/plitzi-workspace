import { createContext } from 'react';

import type { ReactNode } from 'react';

export type LayoutIntent = 'main' | 'login' | 'empty';

/** What a page asks the shell around it to be. Set on mount, cleared on unmount. */
export type LayoutProps = {
  intent?: LayoutIntent;
  title?: string;
  className?: string;
  pageClassName?: string;
  showHeader?: boolean;
};

export type LayoutContextValue = {
  layoutProps: LayoutProps;
  setLayoutProps: (props: LayoutProps) => void;
  sidebarVisible: boolean;
  toggleSidebar: () => void;
  subHeader?: ReactNode;
  setSubHeader: (node: ReactNode) => void;
};

const LayoutContext = createContext<LayoutContextValue | undefined>(undefined);

export default LayoutContext;
