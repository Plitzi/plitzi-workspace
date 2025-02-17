import List from './List';

import type { Meta, StoryObj } from '@storybook/react';

const meta = {
  title: 'List',
  component: List,
  // parameters: {
  //   layout: 'centered'
  // }
  tags: ['autodocs'],
  argTypes: {},
  args: {}
} satisfies Meta<typeof List>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {},
  render: args => <List {...args} />
};
