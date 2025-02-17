import Page from './Page';

import type { Meta, StoryObj } from '@storybook/react';

const meta = {
  title: 'Page',
  component: Page,
  // parameters: {
  //   layout: 'centered'
  // }
  tags: ['autodocs'],
  argTypes: {},
  args: {}
} satisfies Meta<typeof Page>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {},
  render: args => <Page {...args} />
};
