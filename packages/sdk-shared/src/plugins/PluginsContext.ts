import { sharedContext } from '../helpers/sharedContext';

import type { PluginsContextValue } from '../types';

const pluginsContextDefaultValue = { assets: {} } as PluginsContextValue;

const PluginsContext = sharedContext('PluginsContext', pluginsContextDefaultValue);

export default PluginsContext;
