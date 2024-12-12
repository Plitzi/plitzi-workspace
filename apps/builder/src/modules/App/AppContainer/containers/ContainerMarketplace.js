// Packages
import React from 'react';
import Card from '@plitzi/plitzi-ui-components/Card';

// Alias
import Marketplace from '@pmodules/Marketplace/Marketplace';

/** @returns {React.ReactElement} */
const ContainerMarketplace = () => {
  //   const { onSelect = noop } = props;

  return (
    <Card className="grow basis-0 m-4 relative flex flex-col" rounded={false}>
      <Marketplace />
    </Card>
  );
};

export default ContainerMarketplace;
