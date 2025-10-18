import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useSocket } from './SocketContext.js';

const OfflineContext = createContext();

export function useOffline() {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
}

export function OfflineProvider({ children }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState('idle'); // 'idle', 'syncing', 'completed', 'error'
  const [syncProgress, setSyncProgress] = useState(0);
  const [pendingActions, setPendingActions] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [syncErrors, setSyncErrors] = useState([]);
  const [offlineData, setOfflineData] = useState({});

  const { socket } = useSocket();

  // Online/offline status detection
  useEffect(() => {
    const handleOnline = async () => {
      console.log('OfflineContext: Connection restored');
      setIsOnline(true);

      // Check for pending actions and register background sync if available
      try {
        const { getOfflineQueue } = await import('../utils/offlineStorage.js');
        const queue = getOfflineQueue();

        if (queue.length > 0 && 'serviceWorker' in navigator) {
          navigator.serviceWorker.ready
            .then(registration => {
              if ('sync' in registration) {
                return registration.sync.register('background-sync');
              }
            })
            .then(() => {
              console.log('Background sync registered');
            })
            .catch(() => {
              // Fallback to immediate sync if background sync fails
              console.log('Background sync not available, falling back to immediate sync');
              setTimeout(() => syncOfflineData(), 1000);
            });
        } else {
          // Auto-sync when coming back online
          setTimeout(() => syncOfflineData(), 1000);
        }
      } catch (error) {
        console.error('Error checking for background sync:', error);
        // Fallback to immediate sync
        setTimeout(() => syncOfflineData(), 1000);
      }
    };

    const handleOffline = () => {
      console.log('OfflineContext: Connection lost');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Service worker online/offline detection
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'ONLINE_STATUS_CHANGE') {
          setIsOnline(event.data.isOnline);
        } else if (event.data && event.data.type === 'TRIGGER_BACKGROUND_SYNC') {
          console.log('OfflineContext: Background sync triggered by service worker');
          // Trigger sync when background sync is fired
          syncOfflineData();
        }
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Socket integration for real-time sync notifications
  useEffect(() => {
    if (socket) {
      socket.on('sync:completed', (data) => {
        setLastSyncTime(new Date());
        setSyncStatus('completed');
        setSyncProgress(100);
        updatePendingActions();
      });

      socket.on('sync:progress', (data) => {
        setSyncProgress(data.progress);
        setSyncStatus('syncing');
      });

      socket.on('sync:error', (data) => {
        setSyncStatus('error');
        setSyncErrors(prev => [...prev, data.error]);
      });

      return () => {
        socket.off('sync:completed');
        socket.off('sync:progress');
        socket.off('sync:error');
      };
    }
  }, [socket]);

  // Load offline data on mount
  useEffect(() => {
    loadOfflineData();
    updatePendingActions();
  }, []);

  const loadOfflineData = useCallback(async () => {
    try {
      const { getAllOfflineData } = await import('../utils/offlineStorage.js');
      const data = getAllOfflineData();
      setOfflineData(data);
    } catch (error) {
      console.error('Error loading offline data:', error);
    }
  }, []);

  const updatePendingActions = useCallback(async () => {
    try {
      const { getOfflineQueue } = await import('../utils/offlineStorage.js');
      const queue = getOfflineQueue();
      setPendingActions(queue.length);
    } catch (error) {
      console.error('Error updating pending actions:', error);
    }
  }, []);

  const syncOfflineData = useCallback(async () => {
    if (!isOnline || syncStatus === 'syncing') {
      return;
    }

    setSyncStatus('syncing');
    setSyncProgress(0);
    setSyncErrors([]);

    try {
      const { getOfflineQueue, updateOfflineAction, removeOfflineAction } = await import('../utils/offlineStorage.js');
      const { syncAttendanceData, syncDutySessionData, syncHourlyLogData, syncLeaveRequestData } = await import('../services/syncService.js');

      const queue = getOfflineQueue();
      let completed = 0;
      const total = queue.length;

      for (const action of queue) {
        try {
          let result;

          switch (action.action) {
            case 'mark_attendance':
              result = await syncAttendanceData(action.data);
              break;
            case 'start_duty_session':
            case 'end_duty_session':
              result = await syncDutySessionData(action.data);
              break;
            case 'submit_hourly_log':
              result = await syncHourlyLogData(action.data);
              break;
            case 'submit_leave_request':
              result = await syncLeaveRequestData(action.data);
              break;
            default:
              console.warn('Unknown offline action:', action.action);
              continue;
          }

          if (result.success) {
            updateOfflineAction(action.id, { synced: true, syncedAt: Date.now() });
            removeOfflineAction(action.id);
          } else {
            updateOfflineAction(action.id, {
              attempts: (action.attempts || 0) + 1,
              lastError: result.error
            });
          }
        } catch (error) {
          console.error('Sync error for action:', action.id, error);
          updateOfflineAction(action.id, {
            attempts: (action.attempts || 0) + 1,
            lastError: error.message
          });
          setSyncErrors(prev => [...prev, { action: action.id, error: error.message }]);
        }

        completed++;
        setSyncProgress(Math.round((completed / total) * 100));
      }

      setSyncStatus('completed');
      setLastSyncTime(new Date());
      updatePendingActions();
      loadOfflineData();

      // Notify via socket if available
      if (socket) {
        socket.emit('sync:completed', { timestamp: Date.now(), actionsProcessed: total });
      }

    } catch (error) {
      console.error('Sync process error:', error);
      setSyncStatus('error');
      setSyncErrors(prev => [...prev, { type: 'general', error: error.message }]);
    }
  }, [isOnline, syncStatus, socket, updatePendingActions, loadOfflineData]);

  const queueOfflineAction = useCallback(async (action, data, priority = 1) => {
    try {
      const { queueOfflineAction } = await import('../utils/offlineStorage.js');
      const actionId = queueOfflineAction(action, data, priority);
      updatePendingActions();
      return actionId;
    } catch (error) {
      console.error('Error queuing offline action:', error);
      return null;
    }
  }, [updatePendingActions]);

  const clearSyncErrors = useCallback(() => {
    setSyncErrors([]);
  }, []);

  const forceSync = useCallback(() => {
    if (isOnline) {
      syncOfflineData();
    }
  }, [isOnline, syncOfflineData]);

  const value = {
    isOnline,
    syncStatus,
    syncProgress,
    pendingActions,
    lastSyncTime,
    syncErrors,
    offlineData,
    syncOfflineData,
    queueOfflineAction,
    clearSyncErrors,
    forceSync,
    loadOfflineData
  };

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
}