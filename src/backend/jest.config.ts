import type { JestConfigWithTsJest } from 'ts-jest'; // v29.1.0
import { compilerOptions } from './tsconfig.json';

const config: JestConfigWithTsJest = {
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest',
  
  // Set Node.js as test environment
  testEnvironment: 'node',
  
  // Define test file locations
  roots: [
    '<rootDir>/src',
    '<rootDir>/test'
  ],
  
  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx)',
    '**/?(*.)+(spec|test).+(ts|tsx)'
  ],
  
  // TypeScript transformation
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  
  // Path aliases mapping from tsconfig
  moduleNameMapper: {
    '@/(.*)': '<rootDir>/src/$1'
  },
  
  // Test setup and teardown files
  setupFilesAfterEnv: [
    '<rootDir>/test/setup.ts',
    '<rootDir>/test/matchers.ts',
    '<rootDir>/test/globalTeardown.ts'
  ],
  
  // Coverage configuration
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: [
    'text',
    'lcov',
    'json-summary',
    'html',
    'cobertura'
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 85,
      lines: 90,
      statements: 90
    },
    'src/core/**/*.ts': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
    }
  },
  
  // Files to collect coverage from
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/types/**/*',
    '!src/**/index.ts',
    '!src/test/**/*',
    '!src/mocks/**/*'
  ],
  
  // TypeScript configuration
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.json',
      diagnostics: true,
      isolatedModules: true
    }
  },
  
  // Supported file extensions
  moduleFileExtensions: [
    'ts',
    'tsx',
    'js',
    'jsx',
    'json',
    'node'
  ],
  
  // Test timeout in milliseconds
  testTimeout: 10000,
  
  // Parallel test execution
  maxWorkers: '50%',
  
  // Verbose output
  verbose: true,
  
  // Mock cleanup
  clearMocks: true,
  restoreMocks: true,
  
  // Process handling
  detectOpenHandles: true,
  forceExit: true,
  
  // Fail fast
  bail: 1,
  
  // Deprecation handling
  errorOnDeprecated: true,
  
  // Test run notifications
  notify: true,
  notifyMode: 'failure-change',
  
  // Watch mode plugins
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ]
};

export default config;