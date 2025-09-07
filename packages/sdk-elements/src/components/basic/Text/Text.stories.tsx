import Text from './Text';
import defaultInternalProps from '../../../Element/helpers/defaultInternalProps';

import type { Meta, StoryObj } from '@storybook/react';

const meta = {
  title: 'Text',
  component: Text,
  // parameters: {
  //   layout: 'centered'
  // }
  tags: ['autodocs'],
  argTypes: {},
  args: {}
} satisfies Meta<typeof Text>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    internalProps: defaultInternalProps
  },
  render: args => <Text {...args} />
};
