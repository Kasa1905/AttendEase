import React from 'react';
import { useOffline } from '../../contexts/OfflineContext.js';
import StatusCard from './StatusCard.js';
import Button from './Button.js';

export default function OfflineIndicator() {
  const {
    isOnline,
    syncStatus,
    syncProgress,
    pendingActions,
    lastSyncTime,
    syncErrors,
    forceSync
  } = useOffline();

  const getStatusInfo = () => {
    if (!isOnline) {
      return {
        icon: '📴',
        title: 'Offline Mode',
        value: 'No Connection',
        description: `${pendingActions} actions queued`,
        variant: 'warning'
      };
    }

    switch (syncStatus) {
      case 'syncing':
        return {
          icon: '🔄',
          title: 'Synchronizing',
          value: `${syncProgress}%`,
          description: `Syncing ${pendingActions} actions`,
          variant: 'info'
        };
      case 'completed':
        return {
          icon: '✅',
          title: 'Synced',
          value: lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString() : 'Just now',
          description: 'All data synchronized',
          variant: 'success'
        };
      case 'error':
        return {
          icon: '❌',
          title: 'Sync Error',
          value: `${syncErrors.length} errors`,
          description: 'Tap to retry sync',
          variant: 'danger'
        };
      default:
        if (pendingActions > 0) {
          return {
            icon: '⏳',
            title: 'Pending Sync',
            value: `${pendingActions} actions`,
            description: 'Ready to sync',
            variant: 'warning'
          };
        }
        return {
          icon: '📶',
          title: 'Online',
          value: 'Connected',
          description: 'All data current',
          variant: 'success'
        };
    }
  };

  const statusInfo = getStatusInfo();

  const handleCardClick = () => {
    if (syncStatus === 'error' || (!isOnline && pendingActions > 0)) {
      forceSync();
    }
  };

  const getNetworkQuality = () => {
    if (!isOnline) return 'offline';

    // Simple network quality estimation based on recent sync performance
    const timeSinceLastSync = lastSyncTime ? Date.now() - new Date(lastSyncTime).getTime() : Infinity;

    if (timeSinceLastSync < 30000) return 'good'; // Less than 30 seconds
    if (timeSinceLastSync < 120000) return 'fair'; // Less than 2 minutes
    return 'poor';
  };

  const networkQuality = getNetworkQuality();

  return (
    <div className="relative">
      <StatusCard
        {...statusInfo}
        onClick={handleCardClick}
      />

      {/* Network quality indicator */}
      <div className="absolute -top-1 -right-1">
        <div className={`w-3 h-3 rounded-full border-2 border-white ${
          networkQuality === 'good' ? 'bg-green-500' :
          networkQuality === 'fair' ? 'bg-yellow-500' :
          networkQuality === 'poor' ? 'bg-orange-500' : 'bg-red-500'
        }`} />
      </div>

      {/* Sync progress bar for syncing state */}
      {syncStatus === 'syncing' && (
        <div className="mt-2">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${syncProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Quick sync button for pending actions */}
      {isOnline && pendingActions > 0 && syncStatus !== 'syncing' && (
        <div className="mt-2">
          <Button
            onClick={forceSync}
            className="w-full text-sm py-1"
            loading={syncStatus === 'syncing'}
          >
            Sync Now ({pendingActions} pending)
          </Button>
        </div>
      )}

      {/* Last sync timestamp */}
      {lastSyncTime && (
        <div className="mt-1 text-xs text-gray-500 text-center">
          Last synced: {new Date(lastSyncTime).toLocaleString()}
        </div>
      )}

      {/* Error indicator */}
      {syncErrors.length > 0 && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          {syncErrors.length} sync error{syncErrors.length > 1 ? 's' : ''}.
          <button
            onClick={forceSync}
            className="ml-2 underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}