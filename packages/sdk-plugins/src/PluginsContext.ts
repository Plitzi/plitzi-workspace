import { createContext } from 'react';

import type { PluginsContextValue } from '@plitzi/sdk-shared';

const pluginsContextDefaultValue = { assets: {} } as PluginsContextValue;

const PluginsContext = createContext(pluginsContextDefaultValue);

export default PluginsContext;
