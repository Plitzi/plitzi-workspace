// Packages
import React from 'react';

// Relatives
import { Video } from './Video.js';

export default {
  title: 'Components/Video',
  decorators: [],
  component: Video,
  argTypes: {}
};

export const BasicUsage = args => <Video {...args} />;

BasicUsage.args = {};
