import { useMemo } from 'react';

import Custom from './Custom';
import ComponentContext from '../../../Component/ComponentContext';
import defaultInternalProps from '../../../Element/helpers/defaultInternalProps';

import type { ComponentContextValue } from '@plitzi/sdk-shared';
import type { Meta, StoryObj } from '@storybook/react';

const meta = {
  title: 'Custom',
  component: Custom,
  // parameters: {
  //   layout: 'centered'
  // }
  tags: ['autodocs'],
  argTypes: {},
  args: {}
} satisfies Meta<typeof Custom>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    internalProps: defaultInternalProps
  },
  render: function Render(args) {
    const value = useMemo(() => ({}), []);

    return (
      <ComponentContext value={value as ComponentContextValue}>
        <Custom {...args} />
      </ComponentContext>
    );
  }
};
