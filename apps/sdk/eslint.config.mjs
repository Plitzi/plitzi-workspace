// Packages
import path from 'path';

// Relatives
import sharedConfig, { settings } from '@plitzi/sdk-shared/eslint.config.mjs';

export default [
  ...sharedConfig,
  {
    settings: {
      ...settings,
      'import/resolver': {
        ...settings['import/resolver'],
        alias: {
          ...settings['import/resolver'].alias,
          map: [
            ...settings['import/resolver'].alias.map,
            ['@modules', path.resolve('./src/modules')],
            ['@components', path.resolve('./src/components')]
          ]
        }
      }
    },
    ignores: ['**/node_modules/**', 'dist/**']
  }
];
