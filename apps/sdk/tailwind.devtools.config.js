import { join } from 'path';

import sharedConfig from '../../packages/sdk-shared/tailwind.config';

const config = {
  content: [
    join(__dirname, '../../packages/sdk-dev-tools/**/*.{js,ts,tsx,html}')
  ],
  presets: [sharedConfig]
};

export default config;
