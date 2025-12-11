import PlitziSdk from './PlitziSdk';

import type { InternalPropsSTG2 } from '@plitzi/sdk-shared';
import type { Meta, StoryObj } from '@storybook/react';

const meta = {
  title: 'Components/PlitziSdk',
  component: PlitziSdk,
  // parameters: {
  //   layout: 'centered'
  // }
  tags: ['autodocs'],
  argTypes: {},
  args: {}
} satisfies Meta<typeof PlitziSdk>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: { internalProps: { id: '' } as InternalPropsSTG2 },
  render: args => <PlitziSdk {...args} />
};
