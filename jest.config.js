const path = require('path');

module.exports = {
  testEnvironment: 'jest-environment-jsdom',
  coverageReporters: ['clover', 'json', 'lcov', 'text', 'html'],
  setupFilesAfterEnv: ['@plitzi/sdk-shared/jest.setup'],
  moduleNameMapper: {
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1'
  },
  transform: {
    '^.+\\.(js|jsx)$': ['babel-jest', { configFile: path.resolve(__dirname, 'packages/sdk-shared/babel.config.js') }]
  }
};
