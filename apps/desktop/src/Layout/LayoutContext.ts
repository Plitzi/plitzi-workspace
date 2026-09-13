import { createContext } from 'react';

export type LayoutIntent = 'main' | 'empty';

/** What a page asks the shell around it to be. Set on mount, cleared on unmount. */
export type LayoutProps = {
  intent?: LayoutIntent;
  title?: string;
  className?: string;
  pageClassName?: string;
};

export type LayoutContextValue = {
  layoutProps: LayoutProps;
  setLayoutProps: (props: LayoutProps) => void;
  sidebarVisible: boolean;
  toggleSidebar: () => void;
};

const LayoutContext = createContext<LayoutContextValue | undefined>(undefined);

export default LayoutContext;
