import Button from '@plitzi/plitzi-ui/Button';
import clsx from 'clsx';
import { useCallback, useMemo } from 'react';

import { hexToRGB } from '../../../../helpers/utils';

export type PluginItemProps = {
  className?: string;
  name?: string;
  description?: string;
  type?: string;
  latestVersion?: string;
  version?: string;
  icon?: string;
  website?: string;
  color?: string;
  onClick?: (type: string) => void;
};

const PluginItem = ({
  className = '',
  name = 'Plugin Name',
  type = '',
  description = 'Plugin Description',
  latestVersion,
  version,
  icon = '',
  website = '',
  color = '',
  onClick
}: PluginItemProps) => {
  const backgroundColor = useMemo(() => hexToRGB(color, 0.05), [color]);

  const handleClick = useCallback(() => onClick?.(type), [onClick, type]);

  return (
    <div
      className={clsx('flex w-full flex-col rounded-sm border border-gray-300 select-none', className)}
      onClick={handleClick}
      style={{ backgroundImage: `linear-gradient(${backgroundColor} 20%, white)` }}
    >
      <div className="flex justify-between px-4 pt-4 pb-2">
        <div className="flex flex-col">
          <div className="text-sm font-bold">{name}</div>
          <a className="flex items-center text-xs text-gray-500" target="_blank" rel="noreferrer" href={website}>
            {website}
            <i className="fa-solid fa-arrow-up-right-from-square ml-1" />
          </a>
        </div>
        {icon && <div className="h-10 w-10 bg-contain bg-no-repeat" style={{ backgroundImage: `url(${icon})` }} />}
      </div>
      <div className="flex px-4 py-2 text-xs text-gray-500">{description}</div>
      <div className="flex items-center justify-between border-t border-gray-300 px-4 py-2">
        <Button className="rounded-sm">View Plugin</Button>
        <div className="flex">
          {version && latestVersion !== version && (
            <i
              className="fas fa-cloud-download-alt fa-2x mr-4 flex items-center justify-center text-blue-400"
              title="New version available"
            />
          )}
          {version && (
            <div className="flex items-center justify-center rounded-sm bg-blue-400 p-1">
              <i className="fas fa-check fa-2x text-white" title="Plugin Installed" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PluginItem;
