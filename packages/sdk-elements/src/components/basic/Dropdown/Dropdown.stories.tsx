import Dropdown from './Dropdown';

import type { Meta, StoryObj } from '@storybook/react';

const meta = {
  title: 'Dropdown',
  component: Dropdown,
  // parameters: {
  //   layout: 'centered'
  // }
  tags: ['autodocs'],
  argTypes: {},
  args: {}
} satisfies Meta<typeof Dropdown>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {},
  render: args => <Dropdown {...args} />
};
