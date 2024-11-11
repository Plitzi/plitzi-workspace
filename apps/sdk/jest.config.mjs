// Monorepo
import sharedConfig from '@plitzi/sdk-shared/jest.config';

export default {
  ...sharedConfig,
  moduleNameMapper: {
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1'
  }
};
