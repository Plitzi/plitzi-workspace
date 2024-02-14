module.exports = {
  testEnvironment: 'jsdom',
  coverageReporters: ['clover', 'json', 'lcov', 'text', 'html'],
  setupFilesAfterEnv: ['@repo/jest-config/jest.setup.js'],
  moduleNameMapper: {
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1'
  }
};
