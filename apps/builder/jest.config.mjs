// Monorepo
import sharedConfig from '@plitzi/sdk-shared/jest.config';

export default {
  ...sharedConfig,
  moduleNameMapper: {
    '^@pmodules/(.*)$': '<rootDir>/src/modules/$1',
    '^@pcomponents/(.*)$': '<rootDir>/src/components/$1'
  }
};
