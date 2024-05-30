// Packages
import React from 'react';

// Relatives
import Loading from './Loading';

export default {
  component: Loading,
  title: 'Components/Loading'
};

const Template = args => <Loading {...args} />;

export const BasicUsage = Template.bind({});
BasicUsage.args = {};
