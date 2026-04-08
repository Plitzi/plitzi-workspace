import clsx from 'clsx';
import { use, useCallback, useMemo, useState } from 'react';

import PluginsContext from '@plitzi/sdk-plugins/PluginsContext';

import PluginDetails from './PluginDetails';
import { useDevToolsTheme } from '../../../../DevToolsThemeContext';
import List from '../../../List';

import type { ListItem } from '../../../List/List';
import type { Plugin } from '@plitzi/sdk-shared';

export type PluginsViewerProps = {
  className?: string;
};

const PluginsViewer = ({ className }: PluginsViewerProps) => {
  const { isDark } = useDevToolsTheme();
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
            <div className="flex flex-col gap-0.5">
              <span className="capitalize">{pluginKey}</span>
              <span className={clsx('text-[10px]', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                {plugin.manifest.version}
              </span>
            </div>
          )
        };
      }),
    [plugins, isDark]
  );

  const [plugin, setPlugin] = useState<ListItem<Plugin> | undefined>();
  const handleItemSelected = useCallback((pluginSelected?: ListItem<Plugin>) => setPlugin(pluginSelected), []);

  return (
    <div className={clsx('flex h-full w-full', className)}>
      <List className="w-[240px]" items={pluginsParsed} value={plugin} onSelect={handleItemSelected} />
      {plugin ? (
        <PluginDetails
          label={plugin.name}
          version={plugin.manifest.version}
          author={plugin.manifest.author}
          settings={plugin.settings}
        />
      ) : (
        <div
          className={clsx(
            'flex grow flex-col items-center justify-center gap-2',
            isDark ? 'text-zinc-600' : 'text-zinc-400'
          )}
        >
          <i className="fa-solid fa-puzzle-piece text-2xl opacity-30" />
          <span>Select a plugin</span>
        </div>
      )}
    </div>
  );
};

export default PluginsViewer;
