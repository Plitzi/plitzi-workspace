import { BlockJsx } from './BlockJsx';

import type { Meta, StoryObj } from '@storybook/react';

const meta = {
  title: 'BlockJsx',
  component: BlockJsx,
  // parameters: {
  //   layout: 'centered'
  // }
  tags: ['autodocs'],
  argTypes: {},
  args: { id: 'story' }
} satisfies Meta<typeof BlockJsx>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {},
  render: args => <BlockJsx {...args} />
};
