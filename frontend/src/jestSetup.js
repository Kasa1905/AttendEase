// This file runs BEFORE setupFilesAfterEnv and jest-dom
// It's required to polyfill TextEncoder/TextDecoder and TransformStream for MSW (Mock Service Worker)

import { TextEncoder, TextDecoder } from 'util';

// Set up global TextEncoder/TextDecoder for MSW
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Polyfill stream Web APIs for MSW
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { ReadableStream, WritableStream, TransformStream } = require('stream/web');
  global.ReadableStream = ReadableStream;
  global.WritableStream = WritableStream;
  global.TransformStream = TransformStream;
} catch (e) {
  // Fallback if stream/web is not available
  console.warn('Failed to load stream/web polyfills:', e.message);
}

// Polyfill BroadcastChannel for MSW
class BroadcastChannelMock {
  constructor(name) {
    this.name = name;
    this.onmessage = null;
  }

  postMessage(message) {
    // Mock implementation
  }

  close() {
    // Mock implementation
  }
}

if (!global.BroadcastChannel) {
  global.BroadcastChannel = BroadcastChannelMock;
}

// Polyfill import.meta for Jest
if (!global.importMeta) {
  global.importMeta = {
    env: {
      MODE: 'test',
      VITE_API_URL: 'http://localhost:3001',
      VITE_APP_TITLE: 'Club Attendance Manager Test',
      VITE_OFFLINE_CACHE_TTL: '5',
      VITE_SYNC_RETRY_ATTEMPTS: '3',
      VITE_SYNC_RETRY_DELAY: '1000'
    }
  };
}

// Make import.meta available like in Vite
if (!globalThis.import) {
  globalThis.import = { meta: global.importMeta };
}
if (!globalThis.import?.meta) {
  globalThis.import.meta = global.importMeta;
}
if (!globalThis.importMeta) {
  globalThis.importMeta = global.importMeta;
}
