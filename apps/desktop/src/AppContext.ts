import { createContext } from 'react';

import { getEnvironmentServer } from './config/environments';

import type { DesktopEnvironment, DesktopServers } from './config/environments';

export type AppContextValue = DesktopServers & { environment: DesktopEnvironment };

/**
 * Defaulted rather than left undefined: unlike auth or spaces, there is no state here to get wrong — every value
 * is a constant of the build — so a component reading it outside the provider gets the production servers, which
 * is what it would have got anyway.
 */
const AppContext = createContext<AppContextValue>({ environment: 'production', ...getEnvironmentServer('production') });

export default AppContext;
