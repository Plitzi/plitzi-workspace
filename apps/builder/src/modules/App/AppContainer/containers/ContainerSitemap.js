// Packages
import React from 'react';
// import PropTypes from 'prop-types';
// import noop from 'lodash/noop';
import Card from '@plitzi/plitzi-ui-components/Card';

// Alias
import WorkflowDiagram from '@pcomponents/WorkflowDiagram/WorkflowDiagram';
// import SchemaMainContext from '@pmodules/Schema/SchemaMainContext';

const ContainerSitemap = () => {
  // const { pages, pageDefinitions, pageFolders } = useContext(SchemaMainContext);

  return (
    <Card className="mx-[5%] grow m-4 relative flex flex-col overflow-hidden">
      <WorkflowDiagram direction="vertical" />
    </Card>
  );
};

ContainerSitemap.propTypes = {};

export default ContainerSitemap;
