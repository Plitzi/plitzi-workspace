// Packages
import React from 'react';

// Relatives
import { Image } from './Image.js';

export default {
  title: 'Components/Image',
  decorators: [],
  component: Image,
  argTypes: {}
};

export const BasicUsage = args => <Image {...args} />;

BasicUsage.args = {};
