import TabContainer from './TabContainer';
import defaultInternalProps from '../../../Element/helpers/defaultInternalProps';

import type { Meta, StoryObj } from '@storybook/react';

const meta = {
  title: 'TabContainer',
  component: TabContainer,
  // parameters: {
  //   layout: 'centered'
  // }
  tags: ['autodocs'],
  argTypes: {},
  args: {}
} satisfies Meta<typeof TabContainer>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    internalProps: defaultInternalProps
  },
  render: args => <TabContainer {...args} />
};
