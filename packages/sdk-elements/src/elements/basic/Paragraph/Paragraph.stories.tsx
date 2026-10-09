import { Paragraph } from './Paragraph';

import type { Meta, StoryObj } from '@storybook/react';

const meta = {
  title: 'Paragraph',
  component: Paragraph,
  tags: ['autodocs'],
  argTypes: {},
  args: {}
} satisfies Meta<typeof Paragraph>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {},
  render: args => <Paragraph {...args} />
};
