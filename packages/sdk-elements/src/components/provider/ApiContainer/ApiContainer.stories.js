// Packages
import React from 'react';

// Relatives
import { ApiContainer } from './ApiContainer.js';

export default {
  title: 'Components/ApiContainer',
  decorators: [],
  component: ApiContainer,
  argTypes: {}
};

export const BasicUsage = args => <ApiContainer {...args} />;

BasicUsage.args = {};
