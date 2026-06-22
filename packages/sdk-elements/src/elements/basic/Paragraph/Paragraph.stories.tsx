import { Paragraph } from './Paragraph';

import type { Meta, StoryObj } from '@storybook/react';

const meta = {
  title: 'Paragraph',
  component: Paragraph,
  // parameters: {
  //   layout: 'centered'
  // }
  tags: ['autodocs'],
  argTypes: {},
  args: { id: 'story' }
} satisfies Meta<typeof Paragraph>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {},
  render: args => <Paragraph {...args} />
};
