import { createContext } from 'react';

import type { NavigationContextValue } from '@plitzi/sdk-shared';

export type NavigationStatus = 'normal' | 'redirect' | 'notFound' | 'accessDenied';

const navigationContextDefaultValue = {} as NavigationContextValue;

const NavigationContext = createContext<NavigationContextValue>(navigationContextDefaultValue);

export default NavigationContext;
