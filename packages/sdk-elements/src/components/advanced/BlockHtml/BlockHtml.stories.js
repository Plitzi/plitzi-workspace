// Packages
import React from 'react';

// Relatives
import { BlockHtml } from './BlockHtml.js';

export default {
  title: 'Components/BlockHtml',
  decorators: [],
  component: BlockHtml,
  argTypes: {}
};

export const BasicUsage = args => <BlockHtml {...args} />;

BasicUsage.args = {};
