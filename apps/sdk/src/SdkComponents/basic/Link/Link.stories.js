// Packages
import React from 'react';

// Relatives
import { Link } from './Link';
import { PlitziServiceProvider } from '../../../services/hooks/usePlitziServiceContext';

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
