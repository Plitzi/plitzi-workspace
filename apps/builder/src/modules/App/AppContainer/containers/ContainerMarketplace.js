// Packages
import React from 'react';
import Card from '@plitzi/plitzi-ui-components/Card';

// Alias
import Marketplace from '@pmodules/Marketplace/Marketplace';

/**
 * @param {{
 *   onSelect?: (item: object) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const ContainerMarketplace = () => {
  //   const { onSelect = noop } = props;

  return (
    <Card className="mx-[5%] grow basis-0 m-4 relative flex flex-col">
      <Marketplace />
    </Card>
  );
};

export default ContainerMarketplace;
