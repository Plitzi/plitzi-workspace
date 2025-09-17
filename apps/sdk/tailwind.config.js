import { join } from 'path';
import sharedConfig from '../../packages/sdk-shared/tailwind.config';

const config = {
  content: [
    // join(__dirname, "src/**/!(*.stories|*.spec).{js,html}")
    join(__dirname, 'src/**/*.{js,html}'),
    join(__dirname, '../../packages/**/*.{js,ts,tsx,html}'),
    join(__dirname, '../../node_modules/@plitzi/plitzi-ui-components/dist/**/!(*.stories|*.spec).{js,html}')
  ],
  presets: [sharedConfig]
};

export default config;
