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
            [
              'apollo-upload-client/createUploadLink',
              path.resolve('./node_modules/apollo-upload-client/src/createUploadLink.mjs')
            ],
            ['@pmodules', path.resolve('./src/modules/')],
            ['@pcomponents', path.resolve('./src/components/')]
          ]
        }
      }
    },
    ignores: ['**/node_modules/**', 'dist/**']
  }
];
