// const path = require('path');
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

export default {
  testEnvironment: 'jest-environment-jsdom',
  coverageReporters: ['clover', 'json', 'lcov', 'text', 'html'],
  setupFilesAfterEnv: ['@plitzi/sdk-shared/jest.setup'],
  moduleNameMapper: {
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1'
  },
  transform: {
    '^.+\\.(js|jsx)$': ['babel-jest', { configFile: path.resolve(__dirname, './babel.config.cjs') }]
  },
  transformIgnorePatterns: []
};
