import { offlineAPI } from '../utils/api.js';
import { getOfflineQueue, updateOfflineAction, removeOfflineAction } from '../utils/offlineStorage.js';

/**
 * Data synchronization service for offline-to-online sync
 */
export class SyncService {
  constructor() {
    this.syncInProgress = false;
    this.syncResults = {
      total: 0,
      successful: 0,
      failed: 0,
      conflicts: 0
    };
  }

  /**
   * Sync offline attendance records with server
   * @param {Object} attendanceData - Attendance data to sync
   * @returns {Promise<Object>} - Sync result
   */
  async syncAttendanceData(attendanceData) {
    try {
      const response = await offlineAPI.post('/api/attendance', attendanceData, {}, {
        queueOffline: false // Don't queue if already syncing
      });

      return {
        success: true,
        data: response.data,
        action: 'attendance_synced'
      };
    } catch (error) {
      // Handle conflicts (attendance already marked)
      if (error.response && error.response.status === 409) {
        return {
          success: false,
          conflict: true,
          error: 'Attendance already marked for this session',
          serverData: error.response.data
        };
      }

      return {
        success: false,
        error: error.message || 'Failed to sync attendance'
      };
    }
  }

  /**
   * Sync duty session operations with server
   * @param {Object} sessionData - Duty session data to sync
   * @returns {Promise<Object>} - Sync result
   */
  async syncDutySessionData(sessionData) {
    try {
      let endpoint, method;

      if (sessionData.action === 'start') {
        endpoint = '/api/duty-sessions/start';
        method = 'post';
      } else if (sessionData.action === 'end') {
        endpoint = `/api/duty-sessions/${sessionData.sessionId}/end`;
        method = 'put';
      } else {
        throw new Error('Invalid duty session action');
      }

      const response = await offlineAPI.request({
        method,
        url: endpoint,
        data: sessionData
      }, {
        queueOffline: false
      });

      return {
        success: true,
        data: response.data,
        action: 'duty_session_synced'
      };
    } catch (error) {
      // Handle session conflicts
      if (error.response && error.response.status === 409) {
        return {
          success: false,
          conflict: true,
          error: 'Duty session conflict detected',
          serverData: error.response.data
        };
      }

      return {
        success: false,
        error: error.message || 'Failed to sync duty session'
      };
    }
  }

  /**
   * Sync hourly log entries with server
   * @param {Object} logData - Hourly log data to sync
   * @returns {Promise<Object>} - Sync result
   */
  async syncHourlyLogData(logData) {
    try {
      const response = await offlineAPI.post('/api/hourly-logs', logData, {}, {
        queueOffline: false
      });

      return {
        success: true,
        data: response.data,
        action: 'hourly_log_synced'
      };
    } catch (error) {
      // Handle duplicate log conflicts
      if (error.response && error.response.status === 409) {
        return {
          success: false,
          conflict: true,
          error: 'Hourly log already exists for this time period',
          serverData: error.response.data
        };
      }

      return {
        success: false,
        error: error.message || 'Failed to sync hourly log'
      };
    }
  }

  /**
   * Sync leave request submissions with server
   * @param {Object} requestData - Leave request data to sync
   * @returns {Promise<Object>} - Sync result
   */
  async syncLeaveRequestData(requestData) {
    try {
      const response = await offlineAPI.post('/api/leave-requests', requestData, {}, {
        queueOffline: false
      });

      return {
        success: true,
        data: response.data,
        action: 'leave_request_synced'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to sync leave request'
      };
    }
  }

  /**
   * Process the offline action queue in chronological order
   * @returns {Promise<Object>} - Sync report
   */
  async processOfflineQueue() {
    if (this.syncInProgress) {
      throw new Error('Sync already in progress');
    }

    this.syncInProgress = true;
    this.startTime = Date.now();
    this.syncResults = { total: 0, successful: 0, failed: 0, conflicts: 0 };

    try {
      const queue = getOfflineQueue();
      this.syncResults.total = queue.length;

      // Sort by timestamp to maintain chronological order
      const sortedQueue = queue.sort((a, b) => a.timestamp - b.timestamp);

      for (const action of sortedQueue) {
        try {
          let result;

          switch (action.action) {
            case 'mark_attendance':
              result = await this.syncAttendanceData(action.data);
              break;
            case 'start_duty_session':
            case 'end_duty_session':
              result = await this.syncDutySessionData(action.data);
              break;
            case 'submit_hourly_log':
              result = await this.syncHourlyLogData(action.data);
              break;
            case 'submit_leave_request':
              result = await this.syncLeaveRequestData(action.data);
              break;
            default:
              console.warn('Unknown offline action:', action.action);
              continue;
          }

          if (result.success) {
            updateOfflineAction(action.id, { synced: true, syncedAt: Date.now() });
            removeOfflineAction(action.id);
            this.syncResults.successful++;
          } else if (result.conflict) {
            updateOfflineAction(action.id, {
              synced: false,
              conflict: true,
              serverData: result.serverData
            });
            this.syncResults.conflicts++;
          } else {
            updateOfflineAction(action.id, {
              attempts: (action.attempts || 0) + 1,
              lastError: result.error
            });
            this.syncResults.failed++;
          }

          // Emit progress event
          this.emitProgress(Math.round(((this.syncResults.successful + this.syncResults.failed + this.syncResults.conflicts) / this.syncResults.total) * 100));

        } catch (error) {
          console.error('Sync error for action:', action.id, error);
          updateOfflineAction(action.id, {
            attempts: (action.attempts || 0) + 1,
            lastError: error.message
          });
          this.syncResults.failed++;

          this.emitProgress(Math.round(((this.syncResults.successful + this.syncResults.failed + this.syncResults.conflicts) / this.syncResults.total) * 100));
        }
      }

      this.emitSyncComplete();
      return this.generateSyncReport();

    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Resolve data conflicts between local and server data
   * @param {Object} localData - Local offline data
   * @param {Object} serverData - Server data
   * @returns {Object} - Resolution result
   */
  resolveDataConflicts(localData, serverData) {
    // Default strategy: prefer server data for conflicts
    // This can be made configurable based on user preference

    const resolution = {
      strategy: 'server_wins',
      resolvedData: serverData,
      conflicts: []
    };

    // Compare timestamps to detect actual conflicts
    if (localData.timestamp && serverData.updatedAt) {
      const localTime = new Date(localData.timestamp);
      const serverTime = new Date(serverData.updatedAt);

      if (localTime > serverTime) {
        // Local data is newer - could offer user choice
        resolution.conflicts.push({
          field: 'timestamp',
          local: localTime,
          server: serverTime,
          suggestion: 'local_newer'
        });
      }
    }

    return resolution;
  }

  /**
   * Validate offline data before sync
   * @param {Object} data - Data to validate
   * @param {Object} schema - Validation schema
   * @returns {Object} - Validation result
   */
  validateOfflineData(data, schema = {}) {
    const errors = [];

    // Basic required field validation
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

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate detailed sync report
   * @returns {Object} - Sync report
   */
  generateSyncReport() {
    const report = {
      ...this.syncResults,
      timestamp: new Date().toISOString(),
      duration: Date.now() - this.startTime,
      success: this.syncResults.failed === 0 && this.syncResults.conflicts === 0
    };

    // Add performance metrics
    report.metrics = {
      successRate: this.syncResults.total > 0 ? (this.syncResults.successful / this.syncResults.total) * 100 : 0,
      averageTimePerAction: this.syncResults.total > 0 ? report.duration / this.syncResults.total : 0
    };

    return report;
  }

  /**
   * Schedule periodic background sync
   * @param {number} interval - Sync interval in milliseconds
   */
  schedulePeriodicSync(interval = 5 * 60 * 1000) { // 5 minutes default
    setInterval(async () => {
      if (!this.syncInProgress && navigator.onLine) {
        try {
          await this.processOfflineQueue();
        } catch (error) {
          console.error('Periodic sync failed:', error);
        }
      }
    }, interval);
  }

  /**
   * Handle sync errors with retry logic
   * @param {Array} errors - Array of sync errors
   */
  handleSyncErrors(errors) {
    errors.forEach(error => {
      console.error('Sync error:', error);

      // Could implement different retry strategies based on error type
      if (error.type === 'network') {
        // Exponential backoff for network errors
        setTimeout(() => this.retryFailedAction(error.actionId), 2000);
      } else if (error.type === 'validation') {
        // Mark as permanently failed for validation errors
        updateOfflineAction(error.actionId, { permanentlyFailed: true });
      }
    });
  }

  /**
   * Emit sync progress event
   * @param {number} progress - Progress percentage
   */
  emitProgress(progress) {
    window.dispatchEvent(new CustomEvent('sync:progress', {
      detail: { progress, results: this.syncResults }
    }));
  }

  /**
   * Emit sync completion event
   */
  emitSyncComplete() {
    window.dispatchEvent(new CustomEvent('sync:completed', {
      detail: { results: this.syncResults, report: this.generateSyncReport() }
    }));
  }

  /**
   * Retry a failed action
   * @param {string} actionId - Action ID to retry
   */
  async retryFailedAction(actionId) {
    const queue = getOfflineQueue();
    const action = queue.find(a => a.id === actionId);

    if (action) {
      try {
        // Re-run the sync logic for this specific action
        let result;
        switch (action.action) {
          case 'mark_attendance':
            result = await this.syncAttendanceData(action.data);
            break;
          // Add other action types...
        }

        if (result.success) {
          removeOfflineAction(actionId);
        }
      } catch (error) {
        console.error('Retry failed for action:', actionId, error);
      }
    }
  }
}

// Create singleton instance
export const syncService = new SyncService();

// Export individual functions for convenience
export const syncAttendanceData = (data) => syncService.syncAttendanceData(data);
export const syncDutySessionData = (data) => syncService.syncDutySessionData(data);
export const syncHourlyLogData = (data) => syncService.syncHourlyLogData(data);
export const syncLeaveRequestData = (data) => syncService.syncLeaveRequestData(data);
export const processOfflineQueue = () => syncService.processOfflineQueue();
export const resolveDataConflicts = (local, server) => syncService.resolveDataConflicts(local, server);
export const validateOfflineData = (data, schema) => syncService.validateOfflineData(data, schema);
export const generateSyncReport = () => syncService.generateSyncReport();
export const schedulePeriodicSync = (interval) => syncService.schedulePeriodicSync(interval);
export const handleSyncErrors = (errors) => syncService.handleSyncErrors(errors);