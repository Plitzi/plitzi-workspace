// Packages
import { createContext } from 'react';

// Types
import type { PluginsContextValue } from '@plitzi/sdk-shared';

const pluginsContextDefaultValue: PluginsContextValue = {};

const PluginsContext = createContext<PluginsContextValue>(pluginsContextDefaultValue);

export default PluginsContext;
