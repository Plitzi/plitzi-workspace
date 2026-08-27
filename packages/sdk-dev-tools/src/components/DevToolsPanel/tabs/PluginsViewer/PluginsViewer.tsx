import clsx from 'clsx';
import { use, useCallback, useMemo, useState } from 'react';

import PluginsContext from '@plitzi/sdk-plugins/PluginsContext';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';

import PluginDetails from './PluginDetails';
import List from '../../../List';

import type { PluginEntry } from './PluginDetails';
import type { ListItem } from '../../../List/List';

export type PluginsViewerProps = {
  className?: string;
};

const ORIGIN_LABEL: Record<PluginEntry['origin'], string> = {
  'local-custom': 'Shipped with this space',
  remote: 'Installed'
};

/** Plugins from both registers: installed bundles (PluginsContext) and space-shipped ones (component registry). */
const PluginsViewer = ({ className }: PluginsViewerProps) => {
  const { plugins } = use(PluginsContext);
  const { components } = use(ComponentContext);

  const pluginsParsed = useMemo<ListItem<PluginEntry>[]>(() => {
    const entries = new Map<string, PluginEntry>();
    Object.entries(components.current).forEach(([type, component]) => {
      // Named origins only: an absent origin is an SDK element, not a plugin.
      const { origin } = component;
      if (origin !== 'local-custom' && origin !== 'remote') {
        return;
      }

      entries.set(type, { type, origin, version: component.version });
    });

    Object.entries(plugins).forEach(([type, plugin]) => {
      const registered = entries.get(type);
      const { manifest } = plugin;

      entries.set(type, {
        type,
        origin: registered?.origin ?? 'remote',
        version: manifest.version || registered?.version,
        author: manifest.author,
        settings: plugin.settings
      });
    });

    return [...entries.values()].map(entry => ({
      ...entry,
      id: entry.type,
      name: entry.type,
      label: (
        <div className="flex flex-col gap-0.5">
          <span className="capitalize">{entry.type}</span>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
            {entry.version ?? ORIGIN_LABEL[entry.origin]}
          </span>
        </div>
      )
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plugins, components.current]);

  const [plugin, setPlugin] = useState<ListItem<PluginEntry> | undefined>();
  const handleItemSelected = useCallback((pluginSelected?: ListItem<PluginEntry>) => setPlugin(pluginSelected), []);

  return (
    <div className={clsx('flex h-full w-full', className)}>
      <List className="w-[240px]" items={pluginsParsed} value={plugin} onSelect={handleItemSelected} />
      {plugin ? (
        <PluginDetails entry={plugin} />
      ) : (
        <div className="flex grow flex-col items-center justify-center gap-2 text-zinc-400 dark:text-zinc-600">
          <i className="fa-solid fa-puzzle-piece text-2xl opacity-30" />
          <span>Select a plugin</span>
        </div>
      )}
    </div>
  );
};

export default PluginsViewer;
