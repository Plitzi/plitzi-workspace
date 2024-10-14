// Packages
import React from 'react';

// Monorepo
import { PlitziServiceProvider } from '@plitzi/sdk-shared/usePlitziServiceContext';

// Relatives
import { Text } from './Text.js';

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
