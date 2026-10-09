import { Loading } from './Loading';

import type { Meta, StoryObj } from '@storybook/react';

const meta = {
  title: 'Loading',
  component: Loading,
  tags: ['autodocs'],
  argTypes: {},
  args: {}
} satisfies Meta<typeof Loading>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {},
  render: args => <Loading {...args} />
};
