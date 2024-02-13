// Packages
import React from 'react';
import PropTypes from 'prop-types';
import Card from '@plitzi/plitzi-ui-components/Card';

// Alias
import Marketplace from '@pmodules/Marketplace/Marketplace';

const ContainerMarketplace = () => {
  //   const { onSelect = noop } = props;

  return (
    <Card className="mx-[5%] grow basis-0 m-4 relative flex flex-col">
      <Marketplace />
    </Card>
  );
};

ContainerMarketplace.propTypes = {
  onSelect: PropTypes.func
};

export default ContainerMarketplace;
