import { Image } from './Image';

import type { Meta, StoryObj } from '@storybook/react';

const meta = {
  title: 'Image',
  component: Image,
  // parameters: {
  //   layout: 'centered'
  // }
  tags: ['autodocs'],
  argTypes: {},
  args: { id: 'story' }
} satisfies Meta<typeof Image>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {},
  render: args => <Image {...args} />
};
