// Packages
import React from 'react';

// Relatives
import { Button } from './Button.js';

export default {
  title: 'Components/Button',
  decorators: [],
  component: Button,
  argTypes: {}
};

export const BasicUsage = args => <Button {...args} />;

BasicUsage.args = {};
