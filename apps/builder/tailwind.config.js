// Packages
import { join } from 'path';

// Monorepo
import sharedConfig from '@plitzi/sdk-shared/tailwind.config';

const config = {
  content: [
    // join(__dirname, "src/**/!(*.stories|*.spec).{js,html}")
    join(__dirname, 'src/**/*.{js,html}'),
    join(__dirname, '../../node_modules/@plitzi/plitzi-ui-components/dist/**/!(*.stories|*.spec).{js,html}')
  ],
  presets: [sharedConfig]
};

export default config;
