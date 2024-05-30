// Packages
import React from 'react';

// Relatives
import { Heading } from './Heading';

export default {
  title: 'Components/Heading',
  decorators: [],
  component: Heading,
  argTypes: {}
};

export const BasicUsage = args => <Heading {...args} />;

BasicUsage.args = {};
