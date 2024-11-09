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
      Object.keys(plugins).map(pluginKey => ({
        ...(plugins[pluginKey] ?? {}),
        id: pluginKey,
        label: capitalize(pluginKey)
      })),
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
          // definition={element?.definition}
          // attributes={element?.attributes}
          // onSelectElement={onSelectElement}
        />
      )}
    </div>
  );
};

export default PluginsViewer;
