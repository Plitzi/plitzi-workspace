import { LayoutContainer } from './LayoutContainer';

import type { Meta, StoryObj } from '@storybook/react';

const meta = {
  title: 'LayoutContainer',
  component: LayoutContainer,
  tags: ['autodocs'],
  argTypes: {},
  args: {}
} satisfies Meta<typeof LayoutContainer>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {},
  render: args => <LayoutContainer {...args} />
};
