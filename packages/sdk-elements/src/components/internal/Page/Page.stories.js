// Packages
import React from 'react';

// Relatives
import { Page } from './Page.js';

export default {
  title: 'Components/Page',
  decorators: [],
  component: Page,
  argTypes: {}
};

export const BasicUsage = args => <Page {...args} />;

BasicUsage.args = {};
