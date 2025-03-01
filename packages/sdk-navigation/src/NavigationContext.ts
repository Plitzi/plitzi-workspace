import { createContext } from 'react';

import type { NavigationContextValue as NavigationContextValueShared } from '@plitzi/sdk-shared';
import type { Helmet } from 'react-helmet-async';

export type NavigationStatus = 'normal' | 'redirect' | 'notFound' | 'accessDenied';

export type NavigationContextValue = NavigationContextValueShared<typeof Helmet>;

const navigationContextDefaultValue = {} as NavigationContextValue;

const NavigationContext = createContext<NavigationContextValue>(navigationContextDefaultValue);

export default NavigationContext;
