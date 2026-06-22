import { NotFound } from './NotFound';

import type { Meta, StoryObj } from '@storybook/react';

const meta = {
  title: 'NotFound',
  component: NotFound,
  // parameters: {
  //   layout: 'centered'
  // }
  tags: ['autodocs'],
  argTypes: {},
  args: { id: 'story' }
} satisfies Meta<typeof NotFound>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {},
  render: args => <NotFound {...args} />
};
