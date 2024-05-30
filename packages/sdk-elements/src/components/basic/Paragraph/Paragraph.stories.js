// Packages
import React from 'react';

// Relatives
import { Paragraph } from './Paragraph';

export default {
  title: 'Components/Paragraph',
  decorators: [],
  component: Paragraph,
  argTypes: {}
};

export const BasicUsage = args => <Paragraph {...args} />;

BasicUsage.args = {};
