import axios from 'axios';
import { getAccessToken, getRefreshToken, saveTokens, clearTokens } from './auth';
import { API_BASE, OFFLINE_CACHE_TTL, SYNC_RETRY_ATTEMPTS, SYNC_RETRY_DELAY } from '../config/env';
import { queueOfflineAction as storageQueueOfflineAction, getOfflineQueue as storageGetOfflineQueue, clearOfflineQueue as storageClearOfflineQueue } from './offlineStorage';

// Ensure Node adapter in test environment; keep base URL as provided (can be relative like '/api')
const isTestEnv = typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test';
const normalizedBase = isTestEnv ? '/api' : API_BASE;

// Create a dedicated axios instance so adapter/baseURL are isolated
let instance;
try {
  instance = axios.create({ baseURL: normalizedBase });
} catch (_) {
  // Fallback to global axios if create fails
  instance = axios;
  instance.defaults.baseURL = normalizedBase;
}

if (isTestEnv) {
  // COMMENTED OUT: Let axios use default adapter (XHR/fetch) in tests so MSW can intercept
  // try {
  //   // eslint-disable-next-line @typescript-eslint/no-var-requires
  //   const httpAdapter = require('axios/lib/adapters/http');
  //   if (httpAdapter) {
  //     instance.defaults.adapter = httpAdapter;
  //   }
  // } catch (_) {
  //   // ignore
  // }
}

// Offline detection and queue management
let isOfflineMode = false;
let retryTimeouts = new Map();

// Cache for offline responses
const offlineCache = new Map();
const CACHE_TTL = OFFLINE_CACHE_TTL; // from env with default

instance.interceptors.request.use((cfg) => {
  const t = getAccessToken();
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

instance.interceptors.response.use((r) => r, async (err) => {
  // basic 401 handling: try refresh once
  const original = err.config;
  if (err.response && err.response.status === 401 && !original._retry) {
    original._retry = true;
    try {
      const refresh = getRefreshToken();
      if (!refresh) throw err;
      const res = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken: refresh });
      const { accessToken, refreshToken } = res.data;
      saveTokens({ accessToken, refreshToken });
      original.headers.Authorization = `Bearer ${accessToken}`;
      return axios(original);
    } catch (e) {
      clearTokens();
      // emit a window event so AuthProvider can handle logout/navigation centrally
      try { window.dispatchEvent(new CustomEvent('auth:logout')); } catch (_) {}
      return Promise.reject(e);
    }
  }
  return Promise.reject(err);
});

// Enhanced API wrapper with offline support
export class OfflineAwareAPI {
  constructor() {
    // Reset shared state per instance to keep tests deterministic
    offlineCache.clear();
    retryTimeouts = new Map();
    isOfflineMode = false;
    this.initOfflineDetection();
  }

  initOfflineDetection() {
    // Listen for online/offline events
    window.addEventListener('online', () => {
      console.log('API: Connection restored');
      isOfflineMode = false;
      this.processOfflineQueue();
    });

    window.addEventListener('offline', () => {
      console.log('API: Connection lost');
      isOfflineMode = true;
    });

    // Service worker integration
    try {
      if (!navigator.serviceWorker) {
        Object.defineProperty(navigator, 'serviceWorker', {
          value: { addEventListener: () => {} },
          configurable: true,
          writable: true
        });
      }
      if (navigator.serviceWorker?.addEventListener) {
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data && event.data.type === 'ONLINE_STATUS_CHANGE') {
            isOfflineMode = !event.data.isOnline;
          }
        });
      }
    } catch (_) {
      // noop if navigator.serviceWorker is read-only
    }
  }

  async request(config, options = {}) {
    const {
      offlineFallback = false,
      cacheOffline = false,
      queueOffline = false,
      priority = 1
    } = options;

    // Check if we're offline
    const trulyOffline = isOfflineMode || (typeof navigator !== 'undefined' && navigator.onLine === false);
    if (trulyOffline && !offlineFallback) {
      if (queueOffline) {
        // Queue the action for later
        return this.queueOfflineAction(config, priority);
      } else {
        // Try to get cached response
        const cachedResponse = this.getCachedResponse(config);
        if (cachedResponse) {
          return cachedResponse;
        }
        throw new Error('Offline: No cached data available');
      }
    }

    try {
      const response = await instance(config);

      // Cache successful responses for offline use
      if (cacheOffline && response.status === 200) {
        this.cacheResponse(config, response);
      }

      return response;
    } catch (error) {
      // Network error - try offline fallback
      if (offlineFallback && (error?.code === 'ERR_NETWORK' || !navigator.onLine)) {
        const cachedResponse = this.getCachedResponse(config);
        if (cachedResponse) {
          return { ...cachedResponse, _offline: true };
        }
      }

      // If queueOffline is enabled, queue the action
      if (queueOffline && (error?.code === 'ERR_NETWORK' || !navigator.onLine)) {
        return this.queueOfflineAction(config, priority);
      }

      throw error;
    }
  }

  async get(url, config = {}, options = {}) {
    return this.request({ ...config, method: 'get', url }, options);
  }

  async post(url, data, config = {}, options = {}) {
    return this.request({ ...config, method: 'post', url, data }, options);
  }

  async put(url, data, config = {}, options = {}) {
    return this.request({ ...config, method: 'put', url, data }, options);
  }

  async delete(url, config = {}, options = {}) {
    return this.request({ ...config, method: 'delete', url }, options);
  }

  cacheResponse(config, response) {
    const cacheKey = this.generateCacheKey(config);
    const cacheEntry = {
      response: {
        data: response.data,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      },
      timestamp: Date.now(),
      ttl: CACHE_TTL
    };

    offlineCache.set(cacheKey, cacheEntry);

    // Clean up expired cache entries
    this.cleanupExpiredCache();
  }

  getCachedResponse(config) {
    const cacheKey = this.generateCacheKey(config);
    const cached = offlineCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return {
        ...cached.response,
        _cached: true,
        _cacheTimestamp: cached.timestamp
      };
    }

    // Remove expired entry
    if (cached) {
      offlineCache.delete(cacheKey);
    }

    return null;
  }

  generateCacheKey(config) {
    const { method = 'get', url, params, data } = config;
    const keyParts = [method.toUpperCase(), url];

    if (params) {
      keyParts.push(JSON.stringify(params));
    }

    if (data && typeof data === 'object') {
      keyParts.push(JSON.stringify(data));
    }

    return keyParts.join('|');
  }

  cleanupExpiredCache() {
    const now = Date.now();
    for (const [key, entry] of offlineCache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        offlineCache.delete(key);
      }
    }
  }

  async queueOfflineAction(config, priority) {
    const actionId = storageQueueOfflineAction('api_request', { config }, priority);

    if (actionId) {
      // Emit event for offline context
      window.dispatchEvent(new CustomEvent('offline:actionQueued', {
        detail: { id: actionId, config, priority, timestamp: Date.now() }
      }));

      return {
        data: { queued: true, actionId },
        status: 202, // Accepted
        _offline: true,
        _queued: true
      };
    }

    throw new Error('Failed to queue offline action');
  }

  async processOfflineQueue() {
    const queue = storageGetOfflineQueue();
    if (queue.length === 0 || isOfflineMode) {
      return;
    }

    for (const action of queue) {
      if (action.action !== 'api_request') continue;

      try {
        const response = await instance(action.data.config);

        // Emit success event
        window.dispatchEvent(new CustomEvent('offline:actionSynced', {
          detail: { actionId: action.id, success: true, response }
        }));

      } catch (error) {
        action.attempts = (action.attempts || 0) + 1;

        // Retry logic with exponential backoff
        if (action.attempts < SYNC_RETRY_ATTEMPTS) {
          const baseDelay = SYNC_RETRY_DELAY;
          const delay = Math.pow(2, action.attempts) * baseDelay; // exponential backoff
          retryTimeouts.set(action.id, setTimeout(() => {
            this.retryOfflineAction(action);
          }, delay));
        } else {
          // Emit failure event
          window.dispatchEvent(new CustomEvent('offline:actionFailed', {
            detail: { actionId: action.id, error: error.message }
          }));
        }
      }
    }
  }

  async retryOfflineAction(action) {
    try {
      const response = await instance(action.data.config);
      window.dispatchEvent(new CustomEvent('offline:actionSynced', {
        detail: { actionId: action.id, success: true, response }
      }));
    } catch (error) {
      window.dispatchEvent(new CustomEvent('offline:actionFailed', {
        detail: { actionId: action.id, error: error.message }
      }));
    }
  }

  getOfflineQueue() {
    return storageGetOfflineQueue();
  }

  clearOfflineQueue() {
    storageClearOfflineQueue();
    retryTimeouts.forEach(timeout => clearTimeout(timeout));
    retryTimeouts.clear();
  }

  isOffline() {
    return isOfflineMode;
  }

  getCacheStats() {
    return {
      size: offlineCache.size,
      queueLength: storageGetOfflineQueue().length
    };
  }
}

// Create singleton instance
export const offlineAPI = new OfflineAwareAPI();

// Export the original axios instance for backward compatibility
export default instance;
