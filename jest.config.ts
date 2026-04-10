import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.spec.ts'],
  extensionsToTreatAsEsm: ['.ts'],
  setupFiles: ['<rootDir>/tests/helpers/env-test.ts'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  modulePathIgnorePatterns: ['<rootDir>/dist/'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: 'tsconfig.jest.json',
      },
    ],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1.ts',
    '^@controllers/(.*)$': '<rootDir>/src/controllers/$1.ts',
    '^@dtos/(.*)$': '<rootDir>/src/dtos/$1.ts',
    '^@errors/(.*)$': '<rootDir>/src/errors/$1.ts',
    '^@entities/(.*)$': '<rootDir>/src/entities/$1.ts',
    '^@middlewares/(.*)$': '<rootDir>/src/middlewares/$1.ts',
    '^@repositories/(.*)$': '<rootDir>/src/repositories/$1.ts',
    '^@routes/(.*)$': '<rootDir>/src/routes/$1.ts',
    '^@services/(.*)$': '<rootDir>/src/services/$1.ts',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1.ts',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/migrations/**',
  ],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};

export default config;
