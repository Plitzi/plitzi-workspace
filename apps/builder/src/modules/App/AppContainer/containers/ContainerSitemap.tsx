import Card from '@plitzi/plitzi-ui/Card';

import WorkflowDiagram from '@pcomponents/WorkflowDiagram/WorkflowDiagram';
// import SchemaMainContext from '@plitzi/sdk-schema/SchemaMainContext';

const ContainerSitemap = () => {
  // const { pages, pageDefinitions, pageFolders } = use(SchemaMainContext);

  return (
    <Card className="relative flex grow flex-col">
      <Card.Body className="overflow-hidden" grow>
        <WorkflowDiagram direction="vertical" />
      </Card.Body>
    </Card>
  );
};

export default ContainerSitemap;
