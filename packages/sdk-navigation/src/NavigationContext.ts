import { createContext } from 'react';

import type { NavigationContextValue } from '@plitzi/sdk-shared';

const navigationContextDefaultValue = {} as NavigationContextValue;

const NavigationContext = createContext<NavigationContextValue>(navigationContextDefaultValue);

export default NavigationContext;
