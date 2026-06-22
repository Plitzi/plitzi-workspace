import { Link } from './Link';

import type { Meta, StoryObj } from '@storybook/react';

const meta = {
  title: 'Link',
  component: Link,
  // parameters: {
  //   layout: 'centered'
  // }
  tags: ['autodocs'],
  argTypes: {},
  args: { id: 'story' }
} satisfies Meta<typeof Link>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {},
  render: args => <Link {...args} />
};
