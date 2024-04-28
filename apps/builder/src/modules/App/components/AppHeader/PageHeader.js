// Packages
import React, { useCallback, use } from 'react';
import get from 'lodash/get';
import noop from 'lodash/noop';

// Monorepo
import NavigationContext from '@plitzi/sdk-navigation/NavigationContext';

// Alias
import NetworkContext from '@pmodules/Network/NetworkContext';
import SchemaMainContext from '@pmodules/Schema/SchemaMainContext';

/**
 * @param {{
 *   setTabSelected?: (tab: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const PageHeader = props => {
  const { setTabSelected = noop } = props;
  const { pageDefinitions } = use(SchemaMainContext);
  const { currentPageId } = use(NavigationContext);
  const {
    server: { domain }
  } = use(NetworkContext);

  const handleClick = useCallback(() => setTabSelected('pages'), [setTabSelected]);

  const pageLabel = get(pageDefinitions, `${currentPageId}.attributes.name`);

  return (
    <div
      className="h-full flex flex-col justify-center cursor-pointer select-none min-w-0 basis-0 grow text-xs"
      onClick={handleClick}
    >
      <div className="inline max-w-[150px] truncate" title={pageLabel}>
        <span className="">Page: </span>
        <span className="font-bold">{pageLabel}</span>
      </div>
      <div className="truncate max-w-[150px]">{domain || 'https://subdomain.plitzi.app'}</div>
    </div>
  );
};

export default PageHeader;
