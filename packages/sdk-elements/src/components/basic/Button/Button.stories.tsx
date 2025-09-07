import Button from './Button';
import defaultInternalProps from '../../../Element/helpers/defaultInternalProps';

import type { Meta, StoryObj } from '@storybook/react';

const meta = {
  title: 'Button',
  component: Button,
  // parameters: {
  //   layout: 'centered'
  // }
  tags: ['autodocs'],
  argTypes: {},
  args: {}
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    internalProps: defaultInternalProps
  },
  render: args => <Button {...args} />
};
