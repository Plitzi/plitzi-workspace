import { ApiContainer } from './ApiContainer';

import type { Meta, StoryObj } from '@storybook/react';

const meta = {
  title: 'ApiContainer',
  component: ApiContainer,
  // parameters: {
  //   layout: 'centered'
  // }
  tags: ['autodocs'],
  argTypes: {},
  args: { id: 'story' }
} satisfies Meta<typeof ApiContainer>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {},
  render: args => <ApiContainer {...args} />
};
