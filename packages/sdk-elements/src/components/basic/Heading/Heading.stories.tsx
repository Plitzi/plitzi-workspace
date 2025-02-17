import Heading from './Heading';

import type { Meta, StoryObj } from '@storybook/react';

const meta = {
  title: 'Heading',
  component: Heading,
  // parameters: {
  //   layout: 'centered'
  // }
  tags: ['autodocs'],
  argTypes: {},
  args: {}
} satisfies Meta<typeof Heading>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {},
  render: args => <Heading {...args} />
};
