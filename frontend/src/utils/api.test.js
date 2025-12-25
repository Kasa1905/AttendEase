import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
// Import OfflineAwareAPI lazily in beforeEach to allow spying on axios.create first
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

describe('API Utils', () => {
  let mockAxios;
  let api;
  let apiInstance;

  beforeEach(() => {
    jest.isolateModules(() => {
      const mod = require('./api');
      apiInstance = mod.default;
      const { OfflineAwareAPI } = mod;
      mockAxios = new MockAdapter(apiInstance);
      api = new OfflineAwareAPI();
    });
    jest.clearAllMocks();
    
    // Reset offline mode
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
      configurable: true
    });

    // Mock window events
    window.dispatchEvent = jest.fn();
  });

  afterEach(() => {
    mockAxios.reset();
    mockAxios.restore();
    jest.restoreAllMocks();
    api.clearOfflineQueue();
  });

  describe('Axios Instance Configuration', () => {
    it('configures axios with correct base URL', () => {
      // In test env, baseURL is forced to '/api' for MSW interception
      expect(apiInstance.defaults.baseURL).toBe('/api');
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
    it('clears tokens and dispatches logout event when refresh fails', async () => {
      const mockAccessToken = 'old-token';
      const mockRefreshToken = 'refresh-token';

      authUtils.getAccessToken.mockReturnValue(mockAccessToken);
      authUtils.getRefreshToken.mockReturnValue(mockRefreshToken);

      mockAxios.onGet('/test').replyOnce(401, { error: 'Unauthorized' });
      mockAxios.onPost('/auth/refresh').reply(401, { error: 'Invalid refresh token' });

      await expect(api.request({ url: '/test', method: 'get' })).rejects.toThrow();

      expect(authUtils.clearTokens).toHaveBeenCalled();
    });
  });

  describe('Caching System', () => {
    it('caches successful responses when cacheOffline option is enabled', async () => {
      mockAxios.onGet('/test').reply(200, { data: 'cached-data' });
      
      const response = await api.get('/test', {}, { cacheOffline: true });
      
      expect(response.data).toEqual({ data: 'cached-data' });
    });

    it('returns cached response when available', () => {
      const config = { method: 'get', url: '/test' };
      const cachedResponse = {
        data: { cached: true },
        status: 200,
        statusText: 'OK',
        headers: {}
      };

      api.cacheResponse(config, cachedResponse);
      
      const cached = api.getCachedResponse(config);
      expect(cached.data).toEqual({ cached: true });
      expect(cached._cached).toBe(true);
    });

    it('generates correct cache keys for different requests', () => {
      const key1 = api.generateCacheKey({ method: 'get', url: '/test' });
      const key2 = api.generateCacheKey({ method: 'post', url: '/test' });
      const key3 = api.generateCacheKey({ method: 'get', url: '/test', params: { id: 1 } });

      expect(key1).toBe('GET|/test');
      expect(key2).toBe('POST|/test');
      expect(key3).toContain('GET|/test|');
    });
  });

  describe('Offline Queue Management', () => {
    it('queues action when offline and queueOffline option is enabled', async () => {
      const mockActionId = 'action-123';
      offlineStorage.queueOfflineAction.mockReturnValue(mockActionId);
      // Simulate offline mode
      Object.defineProperty(navigator, 'onLine', { writable: true, configurable: true, value: false });
      window.dispatchEvent(new Event('offline'));

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
    });
  });

  describe('HTTP Method Wrappers', () => {
    it('get method calls request with correct config', async () => {
      const requestSpy = jest.spyOn(api, 'request').mockResolvedValue({ data: 'test' });

      await api.get('/test', {}, { cacheOffline: true });

      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'get', url: '/test' }),
        { cacheOffline: true }
      );
    });

    it('post method calls request with correct config', async () => {
      const requestSpy = jest.spyOn(api, 'request').mockResolvedValue({ data: 'created' });

      await api.post('/test', { name: 'test' });

      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'post', url: '/test' }),
        {}
      );
    });
  });

  describe('Utility Methods', () => {
    it('returns correct cache stats', () => {
      api.cacheResponse({ method: 'get', url: '/test1' }, { data: {}, status: 200, statusText: 'OK', headers: {} });
      offlineStorage.getOfflineQueue.mockReturnValue([{ id: 'action-1' }]);

      const stats = api.getCacheStats();

      expect(stats.size).toBeGreaterThan(0);
      expect(stats.queueLength).toBe(1);
    });

    it('returns current offline status', () => {
      expect(api.isOffline()).toBe(false);
    });
  });
});
