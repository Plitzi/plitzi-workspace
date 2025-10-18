import { PlitziSdk } from './PlitziSdk';

export default {
  title: 'Components/PlitziSdk',
  decorators: [],
  component: PlitziSdk,
  argTypes: {}
};

export const BasicUsage = args => <PlitziSdk {...args} />;

BasicUsage.args = {};
