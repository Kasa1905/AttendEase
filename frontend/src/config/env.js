// Vite/browser environment config only
const viteEnv = import.meta.env || {};

// Core API and environment
export const API_BASE = (viteEnv.VITE_API_URL || 'http://localhost:4000') + '/api/v1';
export const ENV = viteEnv.MODE || 'development';
export const IS_PROD = ENV === 'production';

// Sentry configuration
export const SENTRY_DSN = viteEnv.VITE_SENTRY_DSN || '';
export const SENTRY_TRACES_SAMPLE_RATE = Number(viteEnv.VITE_SENTRY_TRACES_SAMPLE_RATE ?? 0.2);
export const APP_VERSION = viteEnv.VITE_APP_VERSION || '1.0.0';

// Offline/Sync configuration
export const OFFLINE_CACHE_TTL = (parseInt(viteEnv.VITE_OFFLINE_CACHE_TTL) || 5) * 60 * 1000; // ms
export const SYNC_RETRY_ATTEMPTS = parseInt(viteEnv.VITE_SYNC_RETRY_ATTEMPTS) || 3;
export const SYNC_RETRY_DELAY = parseInt(viteEnv.VITE_SYNC_RETRY_DELAY) || 1000; // ms
