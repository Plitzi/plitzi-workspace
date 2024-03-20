// Packages
import React, { useContext } from 'react';
import get from 'lodash/get';

// Alias
import SchemaMainContext from '@pmodules/Schema/SchemaMainContext';
import NavigationContext from '@pmodules/Navigation/NavigationContext';

const PageHeader = () => {
  const { pageDefinitions } = useContext(SchemaMainContext);
  const { currentPageId } = useContext(NavigationContext);
  const pageLabel = get(pageDefinitions, `${currentPageId}.attributes.name`);

  return (
    <div className="h-full flex items-center cursor-pointer select-none">
      <div className="flex text-sm">
        <div className="">Page:</div>
        <div className="font-bold">{pageLabel}</div>
      </div>
    </div>
  );
};

export default PageHeader;
