// Packages
import React from 'react';

// Relatives
import { BlockJsx } from './BlockJsx.js';

export default {
  title: 'Components/BlockJsx',
  decorators: [],
  component: BlockJsx,
  argTypes: {}
};

export const BasicUsage = args => <BlockJsx {...args} />;

BasicUsage.args = {};
