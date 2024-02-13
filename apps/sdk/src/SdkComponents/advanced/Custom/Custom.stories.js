// Packages
import React, { useMemo } from 'react';

// Relatives
import { Custom } from './Custom';
import ComponentContext from '../../../modules/Component/ComponentContext';

export default {
  title: 'Components/Custom',
  decorators: [],
  component: Custom,
  argTypes: {}
};

export const BasicUsage = args => {
  const value = useMemo(() => ({}), []);

  return (
    <ComponentContext.Provider value={value}>
      <Custom {...args} />
    </ComponentContext.Provider>
  );
};

BasicUsage.args = {};
