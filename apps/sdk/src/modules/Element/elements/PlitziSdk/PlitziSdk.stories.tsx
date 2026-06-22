import { PlitziSdk } from './PlitziSdk';

import type { Meta, StoryObj } from '@storybook/react';

const meta = {
  title: 'Components/PlitziSdk',
  component: PlitziSdk,
  // parameters: {
  //   layout: 'centered'
  // }
  tags: ['autodocs'],
  argTypes: {},
  args: { id: 'sdk' }
} satisfies Meta<typeof PlitziSdk>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {},
  render: args => <PlitziSdk {...args} />
};
