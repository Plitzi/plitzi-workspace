const path = require('path');
const sharedConfig = require('@repo/eslint-config');

module.exports = {
  ...sharedConfig,
  compilerOptions: {
    baseUrl: './src'
  },
  settings: {
    ...sharedConfig.settings,
    'import/resolver': {
      ...sharedConfig.settings['import/resolver'],
      alias: {
        ...sharedConfig.settings['import/resolver'].alias,
        map: [
          ['@modules', path.resolve('./src/modules')],
          ['@components', path.resolve('./src/components')],
          ['@plitzi/plitzi-ui-components', path.resolve('./node_modules/@plitzi/plitzi-ui-components/dist/components')]
        ]
      }
    }
  }
};
