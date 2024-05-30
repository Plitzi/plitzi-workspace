// Packages
import React from 'react';

// Relatives
import { Dropdown } from './Dropdown';

export default {
  title: 'Components/Dropdown',
  decorators: [],
  component: Dropdown,
  argTypes: {}
};

export const BasicUsage = args => <Dropdown {...args} />;

BasicUsage.args = {};
