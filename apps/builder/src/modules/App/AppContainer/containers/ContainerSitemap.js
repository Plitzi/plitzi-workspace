// Packages
import React from 'react';
// import noop from 'lodash/noop';
import Card from '@plitzi/plitzi-ui-components/Card';

// Alias
import WorkflowDiagram from '@pcomponents/WorkflowDiagram/WorkflowDiagram';
// import SchemaMainContext from '@plitzi/sdk-schema/SchemaMainContext';

/** @returns {React.ReactElement} */
const ContainerSitemap = () => {
  // const { pages, pageDefinitions, pageFolders } = use(SchemaMainContext);

  return (
    <Card className="relative flex grow flex-col overflow-hidden" rounded={false}>
      <WorkflowDiagram direction="vertical" />
    </Card>
  );
};

export default ContainerSitemap;
