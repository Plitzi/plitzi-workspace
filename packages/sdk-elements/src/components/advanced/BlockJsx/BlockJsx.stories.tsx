import BlockJsx from './BlockJsx';
import defaultInternalProps from '../../../Element/helpers/defaultInternalProps';

import type { Meta, StoryObj } from '@storybook/react';

const meta = {
  title: 'BlockJsx',
  component: BlockJsx,
  // parameters: {
  //   layout: 'centered'
  // }
  tags: ['autodocs'],
  argTypes: {},
  args: {}
} satisfies Meta<typeof BlockJsx>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    internalProps: defaultInternalProps
  },
  render: args => <BlockJsx {...args} />
};
