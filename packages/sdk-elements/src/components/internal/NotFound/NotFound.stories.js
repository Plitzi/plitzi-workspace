// Packages
import React from 'react';

// Relatives
import NotFound from './NotFound.js';

export default {
  component: NotFound,
  title: 'Components/NotFound'
};

const Template = args => <NotFound {...args} />;

export const BasicUsage = Template.bind({});
BasicUsage.args = {};
