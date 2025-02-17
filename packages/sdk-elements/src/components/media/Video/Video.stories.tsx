import Video from './Video';

import type { Meta, StoryObj } from '@storybook/react';

const meta = {
  title: 'Video',
  component: Video,
  // parameters: {
  //   layout: 'centered'
  // }
  tags: ['autodocs'],
  argTypes: {},
  args: {}
} satisfies Meta<typeof Video>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {},
  render: args => <Video {...args} />
};
