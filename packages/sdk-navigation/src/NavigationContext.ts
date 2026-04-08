import { createContext } from 'react';

import type { NavigationContextValue } from '@plitzi/sdk-shared';

const navigationContextDefaultValue = {} as NavigationContextValue;

const NavigationContext = createContext(navigationContextDefaultValue);
NavigationContext.displayName = 'NavigationContext';

export default NavigationContext;
