import Card from '@plitzi/plitzi-ui/Card';
import { use, useMemo } from 'react';

import SchemaMainContext from '@plitzi/sdk-schema/SchemaMainContext';
import WorkflowDiagram from '@pmodules/App/components/WorkflowDiagram';

const ContainerSitemap = () => {
  const { pageDefinitions, pageFolders } = use(SchemaMainContext);

  const pages = useMemo(() => Object.values(pageDefinitions), [pageDefinitions]);

  return (
    <Card className="relative flex grow flex-col">
      <Card.Body className="overflow-hidden" grow>
        <WorkflowDiagram pages={pages} pageFolders={pageFolders} />
      </Card.Body>
    </Card>
  );
};

export default ContainerSitemap;
