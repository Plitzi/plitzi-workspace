import { LayoutContainer } from './LayoutContainer';

import type { Meta, StoryObj } from '@storybook/react';

const meta = {
  title: 'LayoutContainer',
  component: LayoutContainer,
  // parameters: {
  //   layout: 'centered'
  // }
  tags: ['autodocs'],
  argTypes: {},
  args: { id: 'story' }
} satisfies Meta<typeof LayoutContainer>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {},
  render: args => <LayoutContainer {...args} />
};
