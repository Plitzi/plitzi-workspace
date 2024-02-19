const path = require('path');
const sharedConfig = require('@plitzi/sdk-shared/.eslintrc.js');

module.exports = {
  ...sharedConfig,
  settings: {
    ...sharedConfig.settings,
    'import/resolver': {
      ...sharedConfig.settings['import/resolver'],
      alias: {
        ...sharedConfig.settings['import/resolver'].alias,
        map: [
          ...sharedConfig.settings['import/resolver'].alias.map,
          [
            'apollo-upload-client/createUploadLink',
            path.resolve('./node_modules/apollo-upload-client/src/createUploadLink.mjs')
          ],
          ['@pmodules', path.resolve('./src/modules/')],
          ['@pcomponents', path.resolve('./src/components/')]
        ]
      }
    }
  }
};
