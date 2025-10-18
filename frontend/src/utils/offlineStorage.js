import { getAccessToken } from './auth.js';

const OFFLINE_STORAGE_PREFIX = 'club_attendance_offline_';
const OFFLINE_QUEUE_KEY = 'club_attendance_offline_queue';
const OFFLINE_DATA_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

/**
 * Save data to offline storage with metadata
 * @param {string} key - Storage key
 * @param {any} data - Data to store
 * @param {number} timestamp - Timestamp (optional, defaults to now)
 * @param {Object} metadata - Additional metadata
 */
export function saveOfflineData(key, data, timestamp = Date.now(), metadata = {}) {
  try {
    const storageKey = `${OFFLINE_STORAGE_PREFIX}${key}`;
    const offlineData = {
      data,
      timestamp,
      synced: false,
      metadata: {
        ...metadata,
        userId: getCurrentUserId(),
        version: '1.0'
      }
    };

    localStorage.setItem(storageKey, JSON.stringify(offlineData));
    return true;
  } catch (error) {
    console.error('Error saving offline data:', error);
    return false;
  }
}

/**
 * Get data from offline storage
 * @param {string} key - Storage key
 * @returns {Object|null} - Stored data with metadata or null if not found/expired
 */
export function getOfflineData(key) {
  try {
    const storageKey = `${OFFLINE_STORAGE_PREFIX}${key}`;
    const storedData = localStorage.getItem(storageKey);

    if (!storedData) {
      return null;
    }

    const offlineData = JSON.parse(storedData);

    // Check if data has expired
    if (Date.now() - offlineData.timestamp > OFFLINE_DATA_TTL) {
      removeOfflineData(key);
      return null;
    }

    return offlineData;
  } catch (error) {
    console.error('Error getting offline data:', error);
    return null;
  }
}

/**
 * Remove offline data
 * @param {string} key - Storage key
 */
export function removeOfflineData(key) {
  try {
    const storageKey = `${OFFLINE_STORAGE_PREFIX}${key}`;
    localStorage.removeItem(storageKey);
  } catch (error) {
    console.error('Error removing offline data:', error);
  }
}

/**
 * Get all offline data
 * @returns {Object} - Object with all offline data keyed by storage key
 */
export function getAllOfflineData() {
  const offlineData = {};
  const keys = Object.keys(localStorage);

  keys.forEach(key => {
    if (key.startsWith(OFFLINE_STORAGE_PREFIX)) {
      const dataKey = key.replace(OFFLINE_STORAGE_PREFIX, '');
      const data = getOfflineData(dataKey);
      if (data) {
        offlineData[dataKey] = data;
      }
    }
  });

  return offlineData;
}

/**
 * Clear expired offline data
 */
export function clearExpiredData() {
  const keys = Object.keys(localStorage);
  const now = Date.now();

  keys.forEach(key => {
    if (key.startsWith(OFFLINE_STORAGE_PREFIX)) {
      try {
        const storedData = localStorage.getItem(key);
        if (storedData) {
          const offlineData = JSON.parse(storedData);
          if (now - offlineData.timestamp > OFFLINE_DATA_TTL) {
            localStorage.removeItem(key);
          }
        }
      } catch (error) {
        // Remove corrupted data
        localStorage.removeItem(key);
      }
    }
  });
}

/**
 * Get storage usage information
 * @returns {Object} - Storage usage statistics
 */
export function getStorageUsage() {
  const keys = Object.keys(localStorage);
  let offlineItems = 0;
  let offlineSize = 0;
  let totalSize = 0;

  keys.forEach(key => {
    const value = localStorage.getItem(key);
    const size = (key.length + (value ? value.length : 0)) * 2; // Rough estimate in bytes
    totalSize += size;

    if (key.startsWith(OFFLINE_STORAGE_PREFIX)) {
      offlineItems++;
      offlineSize += size;
    }
  });

  return {
    offlineItems,
    offlineSize: Math.round(offlineSize / 1024), // KB
    totalSize: Math.round(totalSize / 1024), // KB
    quota: 5 * 1024 * 1024, // 5MB estimate for localStorage
    usagePercent: Math.round((totalSize / (5 * 1024 * 1024)) * 100)
  };
}

/**
 * Mark offline data as synced
 * @param {string} key - Storage key
 */
export function syncOfflineData(key) {
  try {
    const storageKey = `${OFFLINE_STORAGE_PREFIX}${key}`;
    const storedData = localStorage.getItem(storageKey);

    if (storedData) {
      const offlineData = JSON.parse(storedData);
      offlineData.synced = true;
      offlineData.syncedAt = Date.now();
      localStorage.setItem(storageKey, JSON.stringify(offlineData));
    }
  } catch (error) {
    console.error('Error syncing offline data:', error);
  }
}

/**
 * Queue an offline action for later sync
 * @param {string} action - Action type (e.g., 'mark_attendance', 'start_duty_session')
 * @param {Object} data - Action data
 * @param {number} priority - Priority (higher numbers = higher priority)
 */
export function queueOfflineAction(action, data, priority = 1) {
  try {
    const queue = getOfflineQueue();
    const offlineAction = {
      id: generateOfflineId(),
      action,
      data,
      timestamp: Date.now(),
      priority,
      attempts: 0,
      userId: getCurrentUserId()
    };

    queue.push(offlineAction);
    // Sort by priority (higher first) then timestamp (older first)
    queue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.timestamp - b.timestamp;
    });

    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    return offlineAction.id;
  } catch (error) {
    console.error('Error queuing offline action:', error);
    return null;
  }
}

/**
 * Get the offline action queue
 * @returns {Array} - Array of queued offline actions
 */
export function getOfflineQueue() {
  try {
    const queue = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return queue ? JSON.parse(queue) : [];
  } catch (error) {
    console.error('Error getting offline queue:', error);
    return [];
  }
}

/**
 * Clear synced actions from the offline queue
 */
export function clearOfflineQueue() {
  try {
    const queue = getOfflineQueue();
    const activeQueue = queue.filter(action => !action.synced);
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(activeQueue));
  } catch (error) {
    console.error('Error clearing offline queue:', error);
  }
}

/**
 * Remove a specific action from the offline queue
 * @param {string} actionId - Action ID to remove
 */
export function removeOfflineAction(actionId) {
  try {
    const queue = getOfflineQueue();
    const filteredQueue = queue.filter(action => action.id !== actionId);
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(filteredQueue));
  } catch (error) {
    console.error('Error removing offline action:', error);
  }
}

/**
 * Update an offline action (e.g., increment attempts)
 * @param {string} actionId - Action ID
 * @param {Object} updates - Updates to apply
 */
export function updateOfflineAction(actionId, updates) {
  try {
    const queue = getOfflineQueue();
    const actionIndex = queue.findIndex(action => action.id === actionId);

    if (actionIndex !== -1) {
      queue[actionIndex] = { ...queue[actionIndex], ...updates };
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    }
  } catch (error) {
    console.error('Error updating offline action:', error);
  }
}

/**
 * Get current user ID from auth token
 * @returns {string|null} - User ID or null if not authenticated
 */
function getCurrentUserId() {
  try {
    const token = getAccessToken();
    if (token) {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.userId || payload.id;
    }
  } catch (error) {
    // Ignore token parsing errors
  }
  return null;
}

/**
 * Generate a unique ID for offline entries
 * @returns {string} - Unique ID
 */
function generateOfflineId() {
  return `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Initialize cleanup on module load
clearExpiredData();