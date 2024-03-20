// Packages
import React, { useCallback, useContext } from 'react';
import get from 'lodash/get';
import noop from 'lodash/noop';
import PropTypes from 'prop-types';

// Alias
import NetworkContext from '@pmodules/Network/NetworkContext';
import SchemaMainContext from '@pmodules/Schema/SchemaMainContext';
import NavigationContext from '@pmodules/Navigation/NavigationContext';

const PageHeader = props => {
  const { setTabSelected = noop } = props;
  const { pageDefinitions } = useContext(SchemaMainContext);
  const { currentPageId } = useContext(NavigationContext);
  const {
    server: { domain }
  } = useContext(NetworkContext);

  const handleClick = useCallback(() => setTabSelected('pages'), [setTabSelected]);

  const pageLabel = get(pageDefinitions, `${currentPageId}.attributes.name`);

  return (
    <div
      className="h-full flex flex-col justify-center cursor-pointer select-none min-w-0 basis-0 grow"
      onClick={handleClick}
    >
      <div className="inline text-sm max-w-[150px] truncate" title={pageLabel}>
        <span className="">Page: </span>
        <span className="font-bold">{pageLabel}</span>
      </div>
      <div className="text-xs truncate max-w-[150px]">{domain || 'https://subdomain.plitzi.app'}</div>
    </div>
  );
};

PageHeader.propTypes = {
  setTabSelected: PropTypes.func
};

export default PageHeader;
