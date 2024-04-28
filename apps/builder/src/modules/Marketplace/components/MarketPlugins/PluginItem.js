// Packages
import React, { useMemo } from 'react';
import classNames from 'classnames';
import noop from 'lodash/noop';
import Button from '@plitzi/plitzi-ui-components/Button';

// Relatives
import { hexToRGB } from '../../../../helpers/utils';

/**
 * @param {{
 *   className?: string;
 *   name?: string;
 *   description?: string;
 *   type?: string;
 *   latestVersion?: string;
 *   version?: string;
 *   icon?: string;
 *   website?: string;
 *   color?: string;
 *   onClick?: (type: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const PluginItem = props => {
  const {
    className = '',
    name = 'Plugin Name',
    type = '',
    description = 'Plugin Description',
    latestVersion,
    version,
    icon = '',
    website = '',
    color = '',
    onClick = noop
  } = props;
  const backgroundColor = useMemo(() => hexToRGB(color, 0.05), [color]);

  const handleClick = () => onClick(type);

  return (
    <div
      className={classNames('flex flex-col border border-gray-300 rounded w-full select-none', className)}
      onClick={handleClick}
      style={{ backgroundImage: `linear-gradient(${backgroundColor} 20%, white)` }}
    >
      <div className="flex justify-between px-4 pt-4 pb-2">
        <div className="flex flex-col">
          <div className="font-bold text-sm">{name}</div>
          <a className="text-xs text-gray-500 flex items-center" target="_blank" rel="noreferrer" href={website}>
            {website}
            <i className="fa-solid fa-arrow-up-right-from-square ml-1" />
          </a>
        </div>
        {icon && <div className="w-10 h-10 bg-no-repeat bg-contain" style={{ backgroundImage: `url(${icon})` }} />}
      </div>
      <div className="flex px-4 py-2 text-xs text-gray-500">{description}</div>
      <div className="flex items-center justify-between border-t border-gray-300 px-4 py-2">
        <Button className="rounded">View Plugin</Button>
        <div className="flex">
          {version && latestVersion !== version && (
            <i
              className="fas fa-cloud-download-alt fa-2x text-blue-400 items-center justify-center flex mr-4"
              title="New version available"
            />
          )}
          {version && (
            <div className="bg-blue-400 flex items-center justify-center p-1 rounded">
              <i className="fas fa-check fa-2x text-white" title="Plugin Installed" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PluginItem;
