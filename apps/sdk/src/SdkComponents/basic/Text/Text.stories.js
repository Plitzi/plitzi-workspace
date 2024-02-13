// Packages
import React from 'react';

// Relatives
import { Text } from './Text';
import { PlitziServiceProvider } from '../../../services/hooks/usePlitziServiceContext';

export default {
  title: 'Components/Text',
  decorators: [],
  component: Text,
  argTypes: {}
};
// falla debido a que withElement genera una dependencia circular en storybook, buscar manera de romperla

export const BasicUsage = args => (
  <PlitziServiceProvider value={{ settings: { previewMode: true } }}>
    <Text {...args} />
  </PlitziServiceProvider>
);

BasicUsage.args = {};
