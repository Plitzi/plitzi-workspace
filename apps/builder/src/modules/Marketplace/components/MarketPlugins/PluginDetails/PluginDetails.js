// Packages
import React from 'react';
import noop from 'lodash/noop';
import Breadcrumb from '@plitzi/plitzi-ui-components/Breadcrumb';

// Relatives
import DetailsSidebar from './DetailsSidebar';
import DetailsContent from './DetailsContent';

const revisionsDefault = [];

/**
 * @param {{
 *   name?: string;
 *   description?: string;
 *   type?: string;
 *   latestVersion?: string;
 *   version?: string;
 *   revisions?: any[];
 *   icon?: string;
 *   color?: string;
 *   owner?: string;
 *   website?: string;
 *   createdAt?: number;
 *   setPluginSelected?: (plugin: any) => void;
 *   onAdd?: (version: string) => void;
 *   onUpdate?: (version: string) => Promise<boolean>;
 *   onRemove?: () => void;
 * }} props
 * @returns {React.ReactElement}
 */
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

export default PluginDetails;
