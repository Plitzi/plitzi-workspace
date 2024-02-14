// Monorepo
const sharedConfig = require('@repo/jest-config');

module.exports = {
  ...sharedConfig,
  moduleNameMapper: {
    '^@pmodules/(.*)$': '<rootDir>/src/modules/$1',
    '^@pcomponents/(.*)$': '<rootDir>/src/components/$1'
  }
};
