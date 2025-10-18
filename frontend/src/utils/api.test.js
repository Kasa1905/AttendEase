import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { OfflineAwareAPI, offlineAPI } from './api';
import * as authUtils from './auth';
import * as offlineStorage from './offlineStorage';
import { API_BASE } from '../config/env';

// Mock the auth utils
jest.mock('./auth', () => ({
  getAccessToken: jest.fn(),
  getRefreshToken: jest.fn(),
  saveTokens: jest.fn(),
  clearTokens: jest.fn()
}));

// Mock the offline storage utils
jest.mock('./offlineStorage', () => ({
  queueOfflineAction: jest.fn(),
  getOfflineQueue: jest.fn(),
  clearOfflineQueue: jest.fn()
}));

// Mock environment variables
const originalEnv = import.meta.env;
beforeAll(() => {
  import.meta.env = {
    ...originalEnv,
    VITE_OFFLINE_CACHE_TTL: '5',
    VITE_SYNC_RETRY_ATTEMPTS: '3',
    VITE_SYNC_RETRY_DELAY: '1000'
  };
});

afterAll(() => {
  import.meta.env = originalEnv;
});

describe('API Utils', () => {
  let mockAxios;
  let api;

  beforeEach(() => {
    mockAxios = new MockAdapter(axios);
    api = new OfflineAwareAPI();
    jest.clearAllMocks();
    
    // Reset offline mode
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    });

    // Mock window events
    window.dispatchEvent = jest.fn();
  });

  afterEach(() => {
    mockAxios.restore();
    jest.restoreAllMocks();
  });

  describe('Axios Instance Configuration', () => {
    it('configures axios with correct base URL', () => {
      expect(axios.create).toHaveBeenCalledWith({ baseURL: API_BASE });
    });
  });

  describe('Request Interceptor', () => {
    it('adds Authorization header when access token exists', async () => {
      const mockToken = 'test-access-token';
      authUtils.getAccessToken.mockReturnValue(mockToken);
      
      mockAxios.onGet('/test').reply(200, { data: 'test' });
      
      await api.request({ url: '/test', method: 'get' });
      
      const request = mockAxios.history.get[0];
      expect(request.headers.Authorization).toBe(`Bearer ${mockToken}`);
    });

    it('does not add Authorization header when no access token', async () => {
      authUtils.getAccessToken.mockReturnValue(null);
      
      mockAxios.onGet('/test').reply(200, { data: 'test' });
      
      await api.request({ url: '/test', method: 'get' });
      
      const request = mockAxios.history.get[0];
      expect(request.headers.Authorization).toBeUndefined();
    });
  });

  describe('Response Interceptor - Token Refresh', () => {
    it('refreshes token on 401 error and retries original request', async () => {
      const mockAccessToken = 'old-token';
      const mockRefreshToken = 'refresh-token';
      const newTokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token'
      };

      authUtils.getAccessToken.mockReturnValue(mockAccessToken);
      authUtils.getRefreshToken.mockReturnValue(mockRefreshToken);

      // First request fails with 401
      mockAxios.onGet('/test').replyOnce(401, { error: 'Unauthorized' });
      
      // Refresh token request succeeds
      mockAxios.onPost(`${API_BASE}/auth/refresh`).reply(200, newTokens);
      
      // Retry request succeeds
      mockAxios.onGet('/test').reply(200, { data: 'success' });

      const response = await api.request({ url: '/test', method: 'get' });

      expect(authUtils.getRefreshToken).toHaveBeenCalled();
      expect(authUtils.saveTokens).toHaveBeenCalledWith(newTokens);
      expect(response.data).toEqual({ data: 'success' });
      
      // Check that refresh was called with correct data
      const refreshRequest = mockAxios.history.post.find(req => 
        req.url === `${API_BASE}/auth/refresh`
      );
      expect(JSON.parse(refreshRequest.data)).toEqual({ refreshToken: mockRefreshToken });
    });

    it('clears tokens and dispatches logout event when refresh fails', async () => {
      const mockAccessToken = 'old-token';
      const mockRefreshToken = 'refresh-token';

      authUtils.getAccessToken.mockReturnValue(mockAccessToken);
      authUtils.getRefreshToken.mockReturnValue(mockRefreshToken);

      // First request fails with 401
      mockAxios.onGet('/test').replyOnce(401, { error: 'Unauthorized' });
      
      // Refresh token request fails
      mockAxios.onPost(`${API_BASE}/auth/refresh`).reply(401, { error: 'Invalid refresh token' });

      await expect(api.request({ url: '/test', method: 'get' })).rejects.toThrow();

      expect(authUtils.clearTokens).toHaveBeenCalled();
      expect(window.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'auth:logout'
        })
      );
    });

    it('clears tokens and dispatches logout event when no refresh token available', async () => {
      const mockAccessToken = 'old-token';

      authUtils.getAccessToken.mockReturnValue(mockAccessToken);
      authUtils.getRefreshToken.mockReturnValue(null); // No refresh token

      // First request fails with 401
      mockAxios.onGet('/test').reply(401, { error: 'Unauthorized' });

      await expect(api.request({ url: '/test', method: 'get' })).rejects.toThrow();

      expect(authUtils.clearTokens).toHaveBeenCalled();
      expect(window.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'auth:logout'
        })
      );
    });

    it('does not retry request twice on 401 error', async () => {
      const mockAccessToken = 'old-token';
      const mockRefreshToken = 'refresh-token';

      authUtils.getAccessToken.mockReturnValue(mockAccessToken);
      authUtils.getRefreshToken.mockReturnValue(mockRefreshToken);

      // All requests fail with 401
      mockAxios.onGet('/test').reply(401, { error: 'Unauthorized' });
      mockAxios.onPost(`${API_BASE}/auth/refresh`).reply(401, { error: 'Invalid refresh token' });

      await expect(api.request({ url: '/test', method: 'get' })).rejects.toThrow();

      // Should only have one retry attempt
      const getRequests = mockAxios.history.get.filter(req => req.url === '/test');
      expect(getRequests).toHaveLength(1);
    });
  });

  describe('Offline Detection', () => {
    it('initializes offline event listeners', () => {
      const addEventListener = jest.spyOn(window, 'addEventListener');
      
      new OfflineAwareAPI();
      
      expect(addEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(addEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    });

    it('sets offline mode when window goes offline', () => {
      const api = new OfflineAwareAPI();
      
      // Simulate offline event
      const offlineEvent = new Event('offline');
      window.dispatchEvent(offlineEvent);
      
      expect(api.isOffline()).toBe(true);
    });

    it('sets online mode and processes queue when window comes online', () => {
      const api = new OfflineAwareAPI();
      const processQueueSpy = jest.spyOn(api, 'processOfflineQueue').mockImplementation();
      
      // First go offline
      window.dispatchEvent(new Event('offline'));
      expect(api.isOffline()).toBe(true);
      
      // Then go online
      window.dispatchEvent(new Event('online'));
      expect(api.isOffline()).toBe(false);
      expect(processQueueSpy).toHaveBeenCalled();
    });
  });

  describe('Caching System', () => {
    it('caches successful responses when cacheOffline option is enabled', async () => {
      mockAxios.onGet('/test').reply(200, { data: 'cached-data' });
      
      const response = await api.get('/test', {}, { cacheOffline: true });
      
      expect(response.data).toEqual({ data: 'cached-data' });
      
      // Verify cache was populated by trying to get cached response
      const cached = api.getCachedResponse({ method: 'get', url: '/test' });
      expect(cached).toBeTruthy();
      expect(cached.data).toEqual({ data: 'cached-data' });
    });

    it('returns cached response when available', async () => {
      const config = { method: 'get', url: '/test' };
      const cachedResponse = {
        data: { cached: true },
        status: 200,
        statusText: 'OK',
        headers: {}
      };

      // Manually populate cache
      api.cacheResponse(config, cachedResponse);
      
      const cached = api.getCachedResponse(config);
      expect(cached.data).toEqual({ cached: true });
      expect(cached._cached).toBe(true);
      expect(cached._cacheTimestamp).toBeTypeOf('number');
    });

    it('removes expired cache entries', async () => {
      const config = { method: 'get', url: '/test' };
      const response = { data: { test: true }, status: 200, statusText: 'OK', headers: {} };

      // Mock Date.now to simulate expired cache
      const originalNow = Date.now;
      Date.now = jest.fn(() => 1000);
      
      api.cacheResponse(config, response);
      
      // Fast forward time beyond TTL
      Date.now = jest.fn(() => 1000 + (6 * 60 * 1000)); // 6 minutes later
      
      const cached = api.getCachedResponse(config);
      expect(cached).toBeNull();
      
      Date.now = originalNow;
    });

    it('generates correct cache keys for different requests', () => {
      const key1 = api.generateCacheKey({ method: 'get', url: '/test' });
      const key2 = api.generateCacheKey({ method: 'post', url: '/test' });
      const key3 = api.generateCacheKey({ method: 'get', url: '/test', params: { id: 1 } });
      const key4 = api.generateCacheKey({ method: 'get', url: '/test', data: { name: 'test' } });

      expect(key1).toBe('GET|/test');
      expect(key2).toBe('POST|/test');
      expect(key3).toBe('GET|/test|{"id":1}');
      expect(key4).toBe('GET|/test|{"name":"test"}');
    });
  });

  describe('Offline Queue Management', () => {
    it('queues action when offline and queueOffline option is enabled', async () => {
      // Set offline mode
      Object.defineProperty(navigator, 'onLine', { value: false });
      window.dispatchEvent(new Event('offline'));

      const mockActionId = 'action-123';
      offlineStorage.queueOfflineAction.mockReturnValue(mockActionId);

      const response = await api.request(
        { url: '/test', method: 'post', data: { test: true } },
        { queueOffline: true, priority: 2 }
      );

      expect(offlineStorage.queueOfflineAction).toHaveBeenCalledWith(
        'api_request',
        { config: { url: '/test', method: 'post', data: { test: true } } },
        2
      );

      expect(response).toEqual({
        data: { queued: true, actionId: mockActionId },
        status: 202,
        _offline: true,
        _queued: true
      });

      expect(window.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'offline:actionQueued',
          detail: expect.objectContaining({
            id: mockActionId,
            priority: 2
          })
        })
      );
    });

    it('throws error when trying to queue offline and storage fails', async () => {
      // Set offline mode
      Object.defineProperty(navigator, 'onLine', { value: false });
      window.dispatchEvent(new Event('offline'));

      offlineStorage.queueOfflineAction.mockReturnValue(null);

      await expect(
        api.request({ url: '/test' }, { queueOffline: true })
      ).rejects.toThrow('Failed to queue offline action');
    });

    it('processes offline queue when coming back online', async () => {
      const mockQueue = [
        {
          id: 'action-1',
          action: 'api_request',
          data: { config: { url: '/test1', method: 'get' } },
          priority: 1
        },
        {
          id: 'action-2',
          action: 'api_request',
          data: { config: { url: '/test2', method: 'post', data: { test: true } } },
          priority: 2
        }
      ];

      offlineStorage.getOfflineQueue.mockReturnValue(mockQueue);
      mockAxios.onGet('/test1').reply(200, { success: true });
      mockAxios.onPost('/test2').reply(200, { created: true });

      await api.processOfflineQueue();

      expect(window.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'offline:actionSynced',
          detail: expect.objectContaining({
            actionId: 'action-1',
            success: true
          })
        })
      );

      expect(window.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'offline:actionSynced',
          detail: expect.objectContaining({
            actionId: 'action-2',
            success: true
          })
        })
      );
    });
  });

  describe('HTTP Method Wrappers', () => {
    it('get method calls request with correct config', async () => {
      const requestSpy = jest.spyOn(api, 'request').mockResolvedValue({ data: 'test' });

      await api.get('/test', { headers: { 'Custom': 'header' } }, { cacheOffline: true });

      expect(requestSpy).toHaveBeenCalledWith(
        { headers: { 'Custom': 'header' }, method: 'get', url: '/test' },
        { cacheOffline: true }
      );
    });

    it('post method calls request with correct config', async () => {
      const requestSpy = jest.spyOn(api, 'request').mockResolvedValue({ data: 'created' });
      const data = { name: 'test' };

      await api.post('/test', data, { headers: { 'Content-Type': 'application/json' } }, { priority: 2 });

      expect(requestSpy).toHaveBeenCalledWith(
        { headers: { 'Content-Type': 'application/json' }, method: 'post', url: '/test', data },
        { priority: 2 }
      );
    });

    it('put method calls request with correct config', async () => {
      const requestSpy = jest.spyOn(api, 'request').mockResolvedValue({ data: 'updated' });
      const data = { id: 1, name: 'updated' };

      await api.put('/test/1', data);

      expect(requestSpy).toHaveBeenCalledWith(
        { method: 'put', url: '/test/1', data },
        {}
      );
    });

    it('delete method calls request with correct config', async () => {
      const requestSpy = jest.spyOn(api, 'request').mockResolvedValue({ data: 'deleted' });

      await api.delete('/test/1', { params: { force: true } });

      expect(requestSpy).toHaveBeenCalledWith(
        { method: 'delete', url: '/test/1', params: { force: true } },
        {}
      );
    });
  });

  describe('Network Error Handling', () => {
    it('returns cached response on network error when offlineFallback is enabled', async () => {
      const config = { url: '/test', method: 'get' };
      const cachedData = { data: 'cached' };
      
      // Populate cache
      api.cacheResponse(config, { 
        data: cachedData, 
        status: 200, 
        statusText: 'OK', 
        headers: {} 
      });

      // Mock network error
      mockAxios.onGet('/test').networkError();

      const response = await api.request(config, { offlineFallback: true });

      expect(response.data).toEqual(cachedData);
      expect(response._offline).toBe(true);
      expect(response._cached).toBe(true);
    });

    it('throws error when no cached data available and offlineFallback enabled', async () => {
      mockAxios.onGet('/test').networkError();

      await expect(
        api.request({ url: '/test', method: 'get' }, { offlineFallback: true })
      ).rejects.toThrow();
    });
  });

  describe('Utility Methods', () => {
    it('returns correct cache stats', () => {
      // Add some cache entries
      api.cacheResponse({ method: 'get', url: '/test1' }, { data: {}, status: 200, statusText: 'OK', headers: {} });
      api.cacheResponse({ method: 'get', url: '/test2' }, { data: {}, status: 200, statusText: 'OK', headers: {} });

      offlineStorage.getOfflineQueue.mockReturnValue([{ id: 'action-1' }, { id: 'action-2' }]);

      const stats = api.getCacheStats();

      expect(stats.size).toBe(2);
      expect(stats.queueLength).toBe(2);
    });

    it('clears offline queue and timeouts', () => {
      api.clearOfflineQueue();

      expect(offlineStorage.clearOfflineQueue).toHaveBeenCalled();
    });

    it('returns current offline status', () => {
      expect(api.isOffline()).toBe(false);

      // Simulate going offline
      window.dispatchEvent(new Event('offline'));
      expect(api.isOffline()).toBe(true);
    });
  });

  describe('Singleton Instance', () => {
    it('exports singleton offlineAPI instance', () => {
      expect(offlineAPI).toBeInstanceOf(OfflineAwareAPI);
    });
  });

  describe('Service Worker Integration', () => {
    it('listens for service worker messages about online status', () => {
      const addEventListenerSpy = jest.spyOn(navigator.serviceWorker, 'addEventListener');
      
      new OfflineAwareAPI();
      
      expect(addEventListenerSpy).toHaveBeenCalledWith('message', expect.any(Function));
    });
  });

  describe('Retry Logic', () => {
    it('retries failed actions with exponential backoff', async () => {
      jest.useFakeTimers();
      
      const mockQueue = [
        {
          id: 'action-1',
          action: 'api_request',
          data: { config: { url: '/test', method: 'get' } },
          priority: 1,
          attempts: 1
        }
      ];

      offlineStorage.getOfflineQueue.mockReturnValue(mockQueue);
      mockAxios.onGet('/test').reply(500, { error: 'Server error' });

      await api.processOfflineQueue();

      // Fast forward time to trigger retry
      jest.advanceTimersByTime(2000); // Should trigger first retry

      jest.useRealTimers();
    });
  });
});
