import Card from '@plitzi/plitzi-ui/Card';

import Marketplace from '@pmodules/Marketplace/Marketplace';

const ContainerMarketplace = () => {
  //   const { onSelect } = props;

  return (
    <Card className="flex grow basis-0 flex-col">
      <Card.Body grow>
        <Marketplace />
      </Card.Body>
    </Card>
  );
};

export default ContainerMarketplace;
