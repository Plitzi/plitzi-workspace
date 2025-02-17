import Container from './Container';

import type { Meta, StoryObj } from '@storybook/react';

const meta = {
  title: 'Container',
  component: Container,
  // parameters: {
  //   layout: 'centered'
  // }
  tags: ['autodocs'],
  argTypes: {},
  args: {}
} satisfies Meta<typeof Container>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {},
  render: args => <Container {...args} />
};
