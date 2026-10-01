import { sharedContext } from '@plitzi/sdk-shared/helpers/sharedContext';

import type { PluginsContextValue } from '@plitzi/sdk-shared';

const pluginsContextDefaultValue = { assets: {} } as PluginsContextValue;

const PluginsContext = sharedContext('PluginsContext', pluginsContextDefaultValue);

export default PluginsContext;
