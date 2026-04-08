import { createContext } from 'react';

import type { PluginsContextValue } from '@plitzi/sdk-shared';

const pluginsContextDefaultValue = { assets: {} } as PluginsContextValue;

const PluginsContext = createContext(pluginsContextDefaultValue);
PluginsContext.displayName = 'PluginsContext';

export default PluginsContext;
