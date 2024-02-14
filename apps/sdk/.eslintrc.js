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
          ...sharedConfig.settings['import/resolver'].alias.map,
          ['@modules', path.resolve('./src/modules')],
          ['@components', path.resolve('./src/components')]
        ]
      }
    }
  }
};
