// Packages
import React from 'react';

// Relatives
import { Button } from './Button';

export default {
  title: 'Components/Button',
  decorators: [],
  component: Button,
  argTypes: {}
};

export const BasicUsage = args => <Button {...args} />;

BasicUsage.args = {};
