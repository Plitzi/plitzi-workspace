// Packages
import React from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';

// Relatives
import PluginItem from './PluginItem';

const pluginsDefault = [];

const PluginList = ({ plugins = pluginsDefault, onClick = noop }) => (
  <div className="grid grid-cols-4 gap-4 mt-8">
    {plugins.map((plugin, i) => {
      const {
        name,
        description,
        type,
        market: { icon, website, backgroundColor },
        latestVersion,
        version
      } = plugin;

      return (
        <PluginItem
          key={i}
          name={name}
          description={description}
          latestVersion={latestVersion?.version}
          type={type}
          icon={icon}
          website={website}
          color={backgroundColor}
          version={version}
          onClick={onClick}
        />
      );
    })}
  </div>
);

PluginList.propTypes = {
  plugins: PropTypes.array,
  onClick: PropTypes.func
};

export default PluginList;
