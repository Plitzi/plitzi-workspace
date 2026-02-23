import clsx from 'clsx';
import { use, useCallback, useMemo, useState } from 'react';

import PluginsContext from '@plitzi/sdk-plugins/PluginsContext';

import PluginDetails from './PluginDetails';
import List from '../../../List';

import type { ListItem } from '../../../List/List';
import type { Plugin } from '@plitzi/sdk-shared';

export type PluginsViewerProps = {
  className?: string;
};

const PluginsViewer = ({ className }: PluginsViewerProps) => {
  const { plugins } = use(PluginsContext);
  const pluginsParsed = useMemo<ListItem<Plugin>[]>(
    () =>
      Object.keys(plugins).map(pluginKey => {
        const plugin = plugins[pluginKey];

        return {
          ...plugin,
          id: pluginKey,
          name: pluginKey,
          label: (
            <div className="flex flex-col capitalize">
              {pluginKey}
              <span className="text-xs text-gray-500">{plugin.manifest.version}</span>
            </div>
          )
        };
      }),
    [plugins]
  );
  const [plugin, setPlugin] = useState<ListItem<Plugin> | undefined>();

  const handleItemSelected = useCallback((pluginSelected?: ListItem<Plugin>) => setPlugin(pluginSelected), []);

  return (
    <div className={clsx('flex h-full w-full', className)}>
      <List className="w-[300px] p-2" items={pluginsParsed} value={plugin} onSelect={handleItemSelected} />
      {plugin && (
        <PluginDetails
          label={plugin.name}
          version={plugin.manifest.version}
          author={plugin.manifest.author}
          settings={plugin.settings}
        />
      )}
    </div>
  );
};

export default PluginsViewer;
