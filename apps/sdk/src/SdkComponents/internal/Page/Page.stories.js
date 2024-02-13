// Packages
import React from 'react';

// Relatives
import { Page } from './Page';

export default {
  title: 'Components/Page',
  decorators: [],
  component: Page,
  argTypes: {}
};

export const BasicUsage = args => <Page {...args} />;

BasicUsage.args = {};
