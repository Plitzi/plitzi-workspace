// Packages
import React from 'react';

// Monorepo
import { PlitziServiceProvider } from '@plitzi/sdk-shared/usePlitziServiceContext';

// Relatives
import { Link } from './Link.js';

export default {
  title: 'Components/Link',
  decorators: [],
  component: Link,
  argTypes: {}
};

// export const BasicUsage = args => <Link {...args} />;

export const BasicUsage = args => (
  <PlitziServiceProvider value={{ previewMode: true }}>
    <Link {...args} />
  </PlitziServiceProvider>
);

BasicUsage.args = {};
