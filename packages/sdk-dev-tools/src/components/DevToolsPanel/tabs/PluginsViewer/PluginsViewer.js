// Packages
import React, { use, useCallback, useMemo, useState } from 'react';
import classNames from 'classnames';
import capitalize from 'lodash/capitalize.js';

// Monorepo
import PluginsContext from '@plitzi/sdk-plugins/PluginsContext';

// Relatives
import List from '../../../List/index.js';
import PluginDetails from './PluginDetails.js';

/**
 * @param {{
 *   className?: string;
 * }} props
 * @returns {React.ReactElement}
 */
const PluginsViewer = props => {
  const { className } = props;
  const { plugins } = use(PluginsContext);
  const pluginsParsed = useMemo(
    () =>
      Object.keys(plugins).map(pluginKey => {
        const plugin = plugins[pluginKey] ?? {};
        const label = capitalize(pluginKey);

        return {
          ...plugin,
          id: pluginKey,
          name: label,
          label: (
            <div className="flex flex-col">
              {label}
              <span className="text-xs text-gray-500">{plugin.manifest.version}</span>
            </div>
          )
        };
      }),
    [plugins]
  );
  const [plugin, setPlugin] = useState();

  const handleItemSelected = useCallback(pluginSelected => setPlugin(pluginSelected), []);

  return (
    <div className={classNames('flex h-full w-full', className)}>
      <List className="p-2 w-[300px]" items={pluginsParsed} value={plugin} onSelect={handleItemSelected} />
      {plugin && (
        <PluginDetails
          className="grow"
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
