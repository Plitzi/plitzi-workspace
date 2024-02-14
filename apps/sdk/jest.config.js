// Monorepo
const sharedConfig = require('@repo/jest-config');

module.exports = {
  ...sharedConfig,
  moduleNameMapper: {
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1'
  }
};
