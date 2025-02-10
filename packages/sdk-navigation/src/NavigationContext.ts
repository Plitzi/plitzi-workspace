// Packages
import { createContext } from 'react';

export type NavigationStatus = 'normal' | 'redirect' | 'notFound' | 'accessDenied';

export type NavigationContextValue = {
  navigate?: (url: string, isExternal: boolean) => void;
  urlSearchParams?: Record<string, string>;
  routeParams?: Record<string, string>;
  queryParams?: Record<string, string>;
  hostname?: string;
  currentPageId?: string;
};

const navigationContextDefaultValue = {};

const NavigationContext = createContext<NavigationContextValue>(navigationContextDefaultValue);

export default NavigationContext;
