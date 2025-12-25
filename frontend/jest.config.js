module.exports = {
  testEnvironment: 'jsdom',
  setupFiles: ['<rootDir>/src/jestSetup.js'],
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
  testMatch: [
    '<rootDir>/src/smoke.test.{js,jsx}'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '.*\\/config\\/env$': '<rootDir>/src/config/env.test.js',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': '<rootDir>/src/tests/__mocks__/fileMock.js'
  },
  transform: {
    '^.+\\.(js|jsx)$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        ['@babel/preset-react', { runtime: 'automatic' }]
      ]
    }]
  },
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$|@testing-library|msw|@mswjs|until-async|@open-draft))'
  ],
  extensionsToTreatAsEsm: ['.jsx'],
  globals: {
    'import.meta': {
      env: {
        MODE: 'test',
        VITE_API_URL: 'http://localhost:3001',
        VITE_APP_TITLE: 'Club Attendance Manager Test'
      }
    }
  },
  collectCoverageFrom: [
    'src/components/**/*.{js,jsx}',
    'src/contexts/**/*.{js,jsx}',
    'src/hooks/**/*.{js,jsx}',
    'src/utils/**/*.{js,jsx}',
    'src/services/**/*.{js,jsx}',
    '!src/**/*.test.{js,jsx}',
    '!src/tests/**',
    '!src/main.jsx',
    '!src/vite-env.d.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0
    }
  },
  testTimeout: 10000,
  verbose: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true
};