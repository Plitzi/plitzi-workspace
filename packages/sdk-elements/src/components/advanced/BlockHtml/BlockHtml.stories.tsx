import { BlockHtml } from './BlockHtml';

import type { Meta, StoryObj } from '@storybook/react';

const meta = {
  title: 'BlockHtml',
  component: BlockHtml,
  // parameters: {
  //   layout: 'centered'
  // }
  tags: ['autodocs'],
  argTypes: {},
  args: {}
} satisfies Meta<typeof BlockHtml>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {},
  render: args => <BlockHtml {...args} />
};
