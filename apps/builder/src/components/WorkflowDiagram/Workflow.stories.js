// Packages
import React from 'react';

// Relatives
import WorkflowDiagram from './WorkflowDiagram';

export default {
  component: WorkflowDiagram,
  title: 'Components/WorkflowDiagram'
};

const Template = args => <WorkflowDiagram {...args} />;

export const BasicUsage = Template.bind({});
BasicUsage.args = {
  items: ['Homepage', 'One', 'Last']
};
