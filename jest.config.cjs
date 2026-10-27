module.exports = {
  testEnvironment: 'node',
  transform: {},
  testMatch: ['<rootDir>/.test-dist/src/**/*.spec.js'],
  collectCoverageFrom: [
    '.test-dist/src/**/*.js',
    '!.test-dist/src/**/*.spec.js',
    '!.test-dist/src/**/*.dto.js',
    '!.test-dist/src/**/*.entity.js',
    '!.test-dist/src/**/*.module.js',
    '!.test-dist/src/**/*.enum.js',
    '!.test-dist/src/docs/**',
    '!.test-dist/src/main.js',
    '!.test-dist/src/database/data-source.js',
    '!.test-dist/src/database/seed.js',
    '!.test-dist/src/database/migrations/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'json-summary'],
  coverageThreshold: {
    global: {
      statements: 41,
      branches: 41,
      functions: 41,
      lines: 41,
    },
  },
};
