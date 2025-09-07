import List from './List';
import defaultInternalProps from '../../../Element/helpers/defaultInternalProps';

import type { Meta, StoryObj } from '@storybook/react';

const meta = {
  title: 'List',
  component: List,
  // parameters: {
  //   layout: 'centered'
  // }
  tags: ['autodocs'],
  argTypes: {},
  args: {}
} satisfies Meta<typeof List>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    internalProps: defaultInternalProps
  },
  render: args => <List {...args} />
};
