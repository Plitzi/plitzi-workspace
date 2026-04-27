import Sdk from '../src/index';

import type { Meta, StoryObj } from '@storybook/react';

const meta = {
  title: 'Sdk',
  component: Sdk,
  // parameters: {
  //   layout: 'centered'
  // }
  tags: ['autodocs'],
  argTypes: {},
  args: {}
} satisfies Meta<typeof Sdk>;

export default meta;

type Story = StoryObj<typeof meta>;

const heightOffset = 32;

export const Primary: Story = {
  args: {
    webKey:
      'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpYXQiOjE3NjY5Nzc4MTUsImlzcyI6Imh0dHBzOlwvXC9hcGkucGxpdHppLmxvY2FsIiwibmJmIjoxNzY2OTc3ODE1LCJhdWQiOlsiaHR0cHM6XC9cL2FwcC5wbGl0emkubG9jYWwiLCJodHRwczpcL1wvc3NyLnBsaXR6aS5sb2NhbDo0MDAwIiwiaHR0cHM6XC9cL3NlcnZlci5wbGl0emkubG9jYWw6ODg4OCIsImh0dHBzXC9cL2FwcC5wbGl0emkubG9jYWw6MzAwMCIsImh0dHBzOlwvXC9hcHAucGxpdHppLmxvY2FsOjMwMDEiLCJodHRwczpcL1wvd2Vic2l0ZS5wbGl0emkuYXBwIl0sImRhdGEiOnsic3BhY2VJZCI6MX0sInZlcnNpb24iOjF9.yV8wwadxTQh-9JGk0frU2-pj3G8-m2YhG0LwbYEb7EQ',
    environment: 'main'
  },
  render: args => (
    <div className="plitzi-container" style={{ height: `calc(100vh - ${heightOffset}px)` }}>
      <Sdk {...args} />
    </div>
  )
};
