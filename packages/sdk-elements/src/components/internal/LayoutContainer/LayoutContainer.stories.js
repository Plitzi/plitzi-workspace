// Packages
import React from 'react';

// Relatives
import { LayoutContainer } from './LayoutContainer';

export default {
  title: 'Components/LayoutContainer',
  decorators: [],
  component: LayoutContainer,
  argTypes: {}
};

export const BasicUsage = args => <LayoutContainer {...args} />;

BasicUsage.args = {};
