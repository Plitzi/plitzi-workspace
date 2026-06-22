import { NodeHtml } from './NodeHtml';

import type { Meta, StoryObj } from '@storybook/react';

const meta = {
  title: 'NodeHtml',
  component: NodeHtml,
  // parameters: {
  //   layout: 'centered'
  // }
  tags: ['autodocs'],
  argTypes: {},
  args: { id: 'story' }
} satisfies Meta<typeof NodeHtml>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {},
  render: args => <NodeHtml {...args} />
};
