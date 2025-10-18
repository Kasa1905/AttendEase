/**
 * Utility functions for offline functionality
 */

import { queueOfflineAction as storageQueueOfflineAction } from './offlineStorage';

// Re-export queueOfflineAction from offlineStorage for consistency
export const queueOfflineAction = storageQueueOfflineAction;

/**
 * Cache an API response with TTL
 * @param {string} url - API endpoint URL
 * @param {Object} data - Response data
 * @param {number} ttl - Time to live in milliseconds
 */
export function cacheApiResponse(url, data, ttl = 5 * 60 * 1000) {
  try {
    const cacheEntry = {
      data,
      timestamp: Date.now(),
      ttl,
      url
    };
    localStorage.setItem(`api_cache_${btoa(url)}`, JSON.stringify(cacheEntry));
  } catch (error) {
    console.warn('Failed to cache API response:', error);
  }
}

/**
 * Get cached API response
 * @param {string} url - API endpoint URL
 * @returns {Object|null} - Cached response or null
 */
export function getCachedResponse(url) {
  try {
    const cacheKey = `api_cache_${btoa(url)}`;
    const cached = localStorage.getItem(cacheKey);

    if (!cached) return null;

    const cacheEntry = JSON.parse(cached);
    const now = Date.now();

    // Check if cache is expired
    if (now - cacheEntry.timestamp > cacheEntry.ttl) {
      localStorage.removeItem(cacheKey);
      return null;
    }

    return {
      ...cacheEntry.data,
      _cached: true,
      _cacheTimestamp: cacheEntry.timestamp
    };
  } catch (error) {
    console.warn('Failed to get cached response:', error);
    return null;
  }
}

/**
 * Queue an offline action for later sync
 * @param {string} action - Action type
 * @param {Object} data - Action data
 * @param {number} priority - Priority level
 * @returns {string} - Action ID
 */
export { queueOfflineAction } from './offlineStorage';

/**
 * Validate offline data integrity
 * @param {Object} data - Data to validate
 * @param {Object} schema - Validation schema
 * @returns {Object} - Validation result
 */
export function validateOfflineData(data, schema = {}) {
  const errors = [];

  // Required fields validation
  if (schema.required) {
    schema.required.forEach(field => {
      if (!data[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    });
  }

  // Type validation
  if (schema.types) {
    Object.entries(schema.types).forEach(([field, expectedType]) => {
      if (data[field] && typeof data[field] !== expectedType) {
        errors.push(`Invalid type for ${field}: expected ${expectedType}, got ${typeof data[field]}`);
      }
    });
  }

  // Custom validation
  if (schema.custom) {
    Object.entries(schema.custom).forEach(([field, validator]) => {
      if (data[field] && !validator(data[field])) {
        errors.push(`Validation failed for ${field}`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Generate a unique ID for offline entries
 * @returns {string} - Unique ID
 */
export function generateOfflineId() {
  return `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Merge offline data with server data
 * @param {Object} localData - Local offline data
 * @param {Object} serverData - Server data
 * @returns {Object} - Merged data
 */
export function mergeOfflineData(localData, serverData) {
  // Simple merge strategy: prefer server data for conflicts
  // Can be enhanced with more sophisticated conflict resolution

  const merged = { ...serverData };

  // Add any local fields that don't exist on server
  Object.keys(localData).forEach(key => {
    if (!(key in merged)) {
      merged[key] = localData[key];
    }
  });

  // Mark as merged
  merged._merged = true;
  merged._mergeTimestamp = Date.now();

  return merged;
}

/**
 * Calculate data freshness for display
 * @param {number} timestamp - Data timestamp
 * @returns {string} - Human-readable freshness text
 */
export function calculateDataFreshness(timestamp) {
  if (!timestamp) return 'Unknown';

  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

/**
 * Compress offline data for efficient storage
 * @param {Object} data - Data to compress
 * @returns {string} - Compressed data string
 */
export function compressOfflineData(data) {
  // Simple compression using JSON.stringify
  // Can be enhanced with more sophisticated compression algorithms
  try {
    return JSON.stringify(data);
  } catch (error) {
    console.warn('Failed to compress offline data:', error);
    return null;
  }
}

/**
 * Estimate sync completion time based on queue size
 * @param {number} queueSize - Number of queued actions
 * @returns {string} - Estimated time text
 */
export function estimateSyncTime(queueSize) {
  if (queueSize === 0) return 'No actions to sync';

  // Rough estimate: 2 seconds per action
  const estimatedSeconds = queueSize * 2;

  if (estimatedSeconds < 60) {
    return `~${estimatedSeconds}s`;
  }

  const minutes = Math.floor(estimatedSeconds / 60);
  const remainingSeconds = estimatedSeconds % 60;

  if (remainingSeconds === 0) {
    return `~${minutes}m`;
  }

  return `~${minutes}m ${remainingSeconds}s`;
}

/**
 * Check if storage quota is being exceeded
 * @returns {Object} - Storage quota information
 */
export function checkStorageQuota() {
  try {
    const used = JSON.stringify(localStorage).length;
    const quota = 5 * 1024 * 1024; // 5MB typical localStorage limit

    return {
      used,
      quota,
      available: quota - used,
      usagePercent: Math.round((used / quota) * 100),
      isNearLimit: (used / quota) > 0.8,
      isOverLimit: used > quota
    };
  } catch (error) {
    console.warn('Failed to check storage quota:', error);
    return {
      used: 0,
      quota: 0,
      available: 0,
      usagePercent: 0,
      isNearLimit: false,
      isOverLimit: false
    };
  }
}

/**
 * Clean up expired offline data
 * @param {number} maxAge - Maximum age in milliseconds
 */
export function cleanupExpiredData(maxAge = 7 * 24 * 60 * 60 * 1000) { // 7 days
  try {
    const now = Date.now();
    const keys = Object.keys(localStorage);

    keys.forEach(key => {
      if (key.startsWith('offline_') || key.startsWith('api_cache_')) {
        try {
          const data = JSON.parse(localStorage.getItem(key));
          if (data.timestamp && (now - data.timestamp) > maxAge) {
            localStorage.removeItem(key);
          }
        } catch (error) {
          // Remove corrupted data
          localStorage.removeItem(key);
        }
      }
    });
  } catch (error) {
    console.warn('Failed to cleanup expired data:', error);
  }
}

/**
 * Get offline storage statistics
 * @returns {Object} - Storage statistics
 */
export function getOfflineStorageStats() {
  try {
    const keys = Object.keys(localStorage);
    let offlineItems = 0;
    let apiCacheItems = 0;
    let totalSize = 0;

    keys.forEach(key => {
      const value = localStorage.getItem(key);
      const size = key.length + (value ? value.length : 0);

      totalSize += size;

      if (key.startsWith('offline_')) {
        offlineItems++;
      } else if (key.startsWith('api_cache_')) {
        apiCacheItems++;
      }
    });

    return {
      offlineItems,
      apiCacheItems,
      totalItems: keys.length,
      totalSize: Math.round(totalSize / 1024), // KB
      quota: 5 * 1024, // 5MB in KB
      usagePercent: Math.round((totalSize / (5 * 1024 * 1024)) * 100)
    };
  } catch (error) {
    console.warn('Failed to get storage stats:', error);
    return {
      offlineItems: 0,
      apiCacheItems: 0,
      totalItems: 0,
      totalSize: 0,
      quota: 0,
      usagePercent: 0
    };
  }
}

// Auto-cleanup on module load
cleanupExpiredData();