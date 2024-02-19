// Monorepo
const sharedConfig = require('@plitzi/sdk-shared/jest.config');

module.exports = {
  ...sharedConfig,
  moduleNameMapper: {
    '^@pmodules/(.*)$': '<rootDir>/src/modules/$1',
    '^@pcomponents/(.*)$': '<rootDir>/src/components/$1'
  }
};
