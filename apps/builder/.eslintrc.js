const path = require('path');
const sharedConfig = require('@repo/eslint-config');

module.exports = {
  ...sharedConfig,
  settings: {
    ...sharedConfig.settings,
    'import/resolver': {
      ...sharedConfig.settings['import/resolver'],
      alias: {
        ...sharedConfig.settings['import/resolver'].alias,
        map: [
          [
            'apollo-upload-client/createUploadLink',
            path.resolve('./node_modules/apollo-upload-client/src/createUploadLink.mjs')
          ],
          ['@pmodules', path.resolve('./src/modules/')],
          ['@pcomponents', path.resolve('./src/components/')],
          [
            '@plitzi/plitzi-ui-components/hooks',
            path.resolve('./node_modules/@plitzi/plitzi-ui-components/dist/hooks')
          ],
          ['@plitzi/plitzi-ui-components', path.resolve('./node_modules/@plitzi/plitzi-ui-components/dist/components')]
        ]
      }
    }
  }
};
