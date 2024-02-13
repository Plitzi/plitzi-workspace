module.exports = {
  testEnvironment: 'jsdom',
  coverageReporters: ['clover', 'json', 'lcov', 'text', 'html'],
  moduleNameMapper: {
    '^@pmodules/(.*)$': '<rootDir>/src/modules/$1',
    '^@pcomponents/(.*)$': '<rootDir>/src/components/$1'
  }
};
