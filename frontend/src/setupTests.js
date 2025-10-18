// React Testing Library setup
import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';
import 'whatwg-fetch';
import axios from 'axios';

// Force axios to use the Node HTTP adapter so MSW (setupServer) can intercept requests in Jest
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const httpAdapter = require('axios/lib/adapters/http');
  if (httpAdapter) {
    // axios v1 exports a function as default
    axios.defaults.adapter = httpAdapter;
  }
} catch (e) {
  // Fallback: leave default adapter
}

// Configure testing library
configure({ testIdAttribute: 'data-testid' });

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn(() => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
  unobserve: jest.fn()
}));

// Mock ResizeObserver
global.ResizeObserver = jest.fn(() => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
  unobserve: jest.fn()
}));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn()
};
global.localStorage = localStorageMock;

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn()
};
global.sessionStorage = sessionStorageMock;

// Mock window.location
delete window.location;
window.location = {
  href: 'http://localhost:3000',
  origin: 'http://localhost:3000',
  pathname: '/',
  search: '',
  hash: '',
  reload: jest.fn(),
  assign: jest.fn(),
  replace: jest.fn()
};

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn()
  }))
});

// Mock HTMLCanvasElement.getContext
HTMLCanvasElement.prototype.getContext = jest.fn();

// Mock fetch globally
global.fetch = jest.fn();

// Setup MSW (Mock Service Worker)
import { server } from './tests/mocks/server';

// Establish API mocking before all tests
beforeAll(() => {
  // Bypass unhandled requests to reduce noise; tests provide explicit overrides when needed
  server.listen({ onUnhandledRequest: 'bypass' });
});

// Reset any request handlers that we may add during the tests,
// so they don't affect other tests
afterEach(() => {
  server.resetHandlers();
  jest.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

// Clean up after the tests are finished
afterAll(() => {
  server.close();
});

// Custom matchers
expect.extend({
  toBeInTheDOM(received) {
    const pass = received && document.body.contains(received);
    return {
      pass,
      message: () => `Expected element ${pass ? 'not ' : ''}to be in the DOM`
    };
  }
});

// Suppress console errors during tests unless explicitly testing them
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' && (
        args[0].includes('Warning: ReactDOM.render is deprecated') ||
        args[0].includes('Warning: An update to') && args[0].includes('was not wrapped in act')
      )
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
