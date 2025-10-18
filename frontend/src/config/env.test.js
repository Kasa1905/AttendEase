// Jest/test environment config
const nodeEnv = process.env || {};

// Core API and environment - align with MSW handlers that use '/api' paths
export const API_BASE = '/api';
export const ENV = nodeEnv.MODE || 'test';
export const IS_PROD = ENV === 'production';

// Sentry configuration
export const SENTRY_DSN = nodeEnv.VITE_SENTRY_DSN || '';
export const SENTRY_TRACES_SAMPLE_RATE = Number(nodeEnv.VITE_SENTRY_TRACES_SAMPLE_RATE ?? 0.2);
export const APP_VERSION = nodeEnv.VITE_APP_VERSION || '1.0.0';

// Offline/Sync configuration
export const OFFLINE_CACHE_TTL = (parseInt(nodeEnv.VITE_OFFLINE_CACHE_TTL) || 5) * 60 * 1000; // ms
export const SYNC_RETRY_ATTEMPTS = parseInt(nodeEnv.VITE_SYNC_RETRY_ATTEMPTS) || 3;
export const SYNC_RETRY_DELAY = parseInt(nodeEnv.VITE_SYNC_RETRY_DELAY) || 1000; // ms
