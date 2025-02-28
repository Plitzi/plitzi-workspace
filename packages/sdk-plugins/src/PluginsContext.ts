import { createContext } from 'react';

import type { PluginsContextValue } from '@plitzi/sdk-shared';

const pluginsContextDefaultValue = {} as PluginsContextValue;

const PluginsContext = createContext<PluginsContextValue>(pluginsContextDefaultValue);

export default PluginsContext;
