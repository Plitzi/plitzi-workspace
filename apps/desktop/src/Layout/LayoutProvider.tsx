import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import { useCallback, useMemo, useState } from 'react';

import LayoutContext from './LayoutContext';

import type { LayoutContextValue, LayoutProps } from './LayoutContext';
import type { ReactNode } from 'react';

export type LayoutProviderProps = { children?: ReactNode };

/**
 * The shell's own state, and nothing else.
 *
 * The 2023 provider also fetched the spaces and held the active one, so the sidebar's collapse state and a
 * network read lived in one value — every space that arrived re-rendered everything that read the layout. Spaces
 * are `SpacesProvider`'s now; what is left here is what the chrome remembers.
 */
const LayoutProvider = ({ children }: LayoutProviderProps) => {
  const [sidebarVisible, setSidebarVisible] = useStorage('plitzi-desktop.layout.sidebar', true);
  const [layoutProps, setLayoutProps] = useState<LayoutProps>({});
  const [subHeader, setSubHeader] = useState<ReactNode>(undefined);

  const toggleSidebar = useCallback(() => setSidebarVisible(!sidebarVisible), [setSidebarVisible, sidebarVisible]);

  const value = useMemo<LayoutContextValue>(
    () => ({ layoutProps, setLayoutProps, sidebarVisible, toggleSidebar, subHeader, setSubHeader }),
    [layoutProps, sidebarVisible, toggleSidebar, subHeader]
  );

  return <LayoutContext value={value}>{children}</LayoutContext>;
};

export default LayoutProvider;
