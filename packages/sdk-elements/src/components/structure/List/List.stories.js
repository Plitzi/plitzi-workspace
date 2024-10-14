// Packages
import React from 'react';

// Relatives
import { List } from './List.js';

export default {
  title: 'Components/List',
  decorators: [],
  component: List,
  argTypes: {}
};

export const BasicUsage = args => <List {...args} />;

BasicUsage.args = {};
