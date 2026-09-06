import { use, useEffect } from 'react';

import LayoutContext from './LayoutContext';

import type { LayoutContextValue, LayoutProps } from './LayoutContext';

export const useLayout = (): LayoutContextValue => {
  const value = use(LayoutContext);
  if (!value) {
    throw new Error('useLayout was called outside LayoutProvider');
  }

  return value;
};

/**
 * A page's own description of the shell it wants, applied while it is mounted.
 *
 * Every page in the 2023 build wrote the same `useLayoutEffect` with the same cleanup, and the ones that forgot
 * the cleanup left the next page wearing their layout. `props` is deliberately taken as a value and read through
 * `JSON.stringify`: page layouts are small literals written inline, so requiring every page to memoise one would
 * be a rule to remember rather than a rule the code keeps.
 */
export const usePageLayout = (props: LayoutProps): void => {
  const { setLayoutProps } = useLayout();
  const serialized = JSON.stringify(props);

  useEffect(() => {
    setLayoutProps(JSON.parse(serialized) as LayoutProps);

    return () => setLayoutProps({});
  }, [serialized, setLayoutProps]);
};

export default useLayout;
