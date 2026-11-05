import { sharedContext } from '../../react/sharedContext';

import type { PluginsContextValue } from '../../types';

// Only a render with no provider above it reads this: it draws no plugin, and registers no style.
const pluginsContextDefaultValue: PluginsContextValue = {
  plugins: {},
  registerCustomAssets: () => undefined,
  unregisterCustomAssets: () => undefined
};

const PluginsContext = sharedContext('PluginsContext', pluginsContextDefaultValue);

export default PluginsContext;
