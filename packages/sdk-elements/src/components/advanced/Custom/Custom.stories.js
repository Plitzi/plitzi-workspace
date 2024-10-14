// Packages
import React, { useMemo } from 'react';

// Relatives
import ComponentContext from '../../../Component/ComponentContext';
import { Custom } from './Custom.js';

export default {
  title: 'Components/Custom',
  decorators: [],
  component: Custom,
  argTypes: {}
};

export const BasicUsage = args => {
  const value = useMemo(() => ({}), []);

  return (
    <ComponentContext value={value}>
      <Custom {...args} />
    </ComponentContext>
  );
};

BasicUsage.args = {};
