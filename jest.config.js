const path = require('path');

module.exports = {
  testEnvironment: 'jest-environment-jsdom',
  coverageReporters: ['clover', 'json', 'lcov', 'text', 'html'],
  setupFilesAfterEnv: ['<rootDir>/packages/sdk-shared/jest.setup.js'],
  moduleNameMapper: {},
  transform: {
    '^.+\\.(js|jsx)$': ['babel-jest', { configFile: path.resolve(__dirname, 'packages/sdk-shared/babel.config.mjs') }]
  }
};
