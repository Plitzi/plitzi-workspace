// Packages
import React from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';
import Breadcrumb from '@plitzi/plitzi-ui-components/Breadcrumb';

// Relatives
import DetailsSidebar from './DetailsSidebar';
import DetailsContent from './DetailsContent';

const revisionsDefault = [];

const PluginDetails = props => {
  const {
    name = 'Plugin Name',
    description = 'Plugin Description',
    icon = '',
    color = '',
    owner = 'Plitzi',
    website = 'https://plitzi.com',
    revisions = revisionsDefault,
    version,
    latestVersion,
    createdAt = 0,
    setPluginSelected = noop,
    onAdd = noop,
    onUpdate = noop,
    onRemove = noop
  } = props;

  const handleClickBack = () => {
    setPluginSelected(undefined);
  };

  return (
    <div className="flex flex-col grow basis-0">
      <Breadcrumb separator="/" className="bg-blue-100 px-6 py-4 rounded">
        <span className="cursor-pointer font-bold" onClick={handleClickBack}>
          Plugins
        </span>
        {name}
      </Breadcrumb>
      <div className="flex grow basis-0 mt-10 overflow-auto px-4 mb-6">
        <DetailsContent />
        <DetailsSidebar
          name={name}
          description={description}
          icon={icon}
          color={color}
          owner={owner}
          website={website}
          createdAt={createdAt}
          version={version}
          latestVersion={latestVersion}
          revisions={revisions}
          onAdd={onAdd}
          onUpdate={onUpdate}
          onRemove={onRemove}
        />
      </div>
    </div>
  );
};

PluginDetails.propTypes = {
  name: PropTypes.string,
  description: PropTypes.string,
  type: PropTypes.string,
  latestVersion: PropTypes.string,
  version: PropTypes.string,
  revisions: PropTypes.array,
  icon: PropTypes.string,
  color: PropTypes.string,
  owner: PropTypes.string,
  website: PropTypes.string,
  createdAt: PropTypes.number,
  setPluginSelected: PropTypes.func,
  onAdd: PropTypes.func,
  onUpdate: PropTypes.func,
  onRemove: PropTypes.func
};

export default PluginDetails;
