// Packages
import React from 'react';

// Relatives
import { Container } from './Container.js';

export default {
  title: 'Components/Container',
  decorators: [],
  component: Container,
  argTypes: {}
};

export const BasicUsage = args => <Container {...args} />;

BasicUsage.args = {};
