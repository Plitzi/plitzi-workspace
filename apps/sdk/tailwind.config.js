import { join } from 'path';
import sharedConfig from '../../packages/sdk-shared/tailwind.config';

const config = {
  content: [
    // join(__dirname, "src/**/!(*.stories|*.spec).{js,html}")
    join(__dirname, 'src/**/*.{js,html}'),
    join(__dirname, '../../packages/**/*.{js,ts,tsx,html}')
  ],
  presets: [sharedConfig]
};

export default config;
