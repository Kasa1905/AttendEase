import React, { useState, useEffect } from 'react';
import { useOffline } from '../../contexts/OfflineContext.js';
import Button from './Button.js';
import ProgressBar from './ProgressBar.js';

export default function SyncStatusModal({ isOpen, onClose }) {
  const {
    syncStatus,
    syncProgress,
    pendingActions,
    syncErrors,
    offlineData,
    syncOfflineData,
    clearSyncErrors
  } = useOffline();

  const [detailedProgress, setDetailedProgress] = useState({});
  const [selectedConflict, setSelectedConflict] = useState(null);
  const [conflictResolution, setConflictResolution] = useState({});

  useEffect(() => {
    if (isOpen) {
      // Listen for detailed sync progress
      const handleProgress = (event) => {
        const { progress, results } = event.detail;
        setDetailedProgress({ progress, results });
      };

      window.addEventListener('sync:progress', handleProgress);
      return () => window.removeEventListener('sync:progress', handleProgress);
    }
  }, [isOpen]);

  const handleManualSync = async () => {
    try {
      await syncOfflineData();
    } catch (error) {
      console.error('Manual sync failed:', error);
    }
  };

  const handleRetryError = (errorIndex) => {
    // Implement retry logic for specific errors
    console.log('Retrying error:', errorIndex);
  };

  const handleConflictResolution = (conflictId, resolution) => {
    setConflictResolution(prev => ({
      ...prev,
      [conflictId]: resolution
    }));
  };

  const getSyncStatistics = () => {
    const results = detailedProgress.results || {};
    const total = results.total || pendingActions;
    const successful = results.successful || 0;
    const failed = results.failed || syncErrors.length;
    const conflicts = results.conflicts || 0;

    return { total, successful, failed, conflicts };
  };

  const stats = getSyncStatistics();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Synchronization Status</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Overall Progress */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="font-medium">Overall Progress</span>
            <span className="text-sm text-gray-600">
              {syncStatus === 'syncing' ? `${syncProgress}%` : 'Complete'}
            </span>
          </div>
          <ProgressBar
            percent={syncProgress}
            color={syncStatus === 'completed' ? 'bg-green-500' : 'bg-blue-500'}
          />
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-3 bg-blue-50 rounded">
            <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-sm text-gray-600">Total</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded">
            <div className="text-2xl font-bold text-green-600">{stats.successful}</div>
            <div className="text-sm text-gray-600">Successful</div>
          </div>
          <div className="text-center p-3 bg-red-50 rounded">
            <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
            <div className="text-sm text-gray-600">Failed</div>
          </div>
          <div className="text-center p-3 bg-yellow-50 rounded">
            <div className="text-2xl font-bold text-yellow-600">{stats.conflicts}</div>
            <div className="text-sm text-gray-600">Conflicts</div>
          </div>
        </div>

        {/* Sync Status Details */}
        <div className="mb-6">
          <h3 className="font-medium mb-3">Sync Progress</h3>
          <div className="text-sm text-gray-600">
            {syncStatus === 'syncing' ? (
              <span>Processing {stats.successful + stats.failed} of {stats.total} actions...</span>
            ) : (
              <span>Sync completed. {stats.successful} successful, {stats.failed} failed, {stats.conflicts} conflicts.</span>
            )}
          </div>
        </div>

        {/* Errors Section */}
        {syncErrors.length > 0 && (
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium text-red-600">Sync Errors</h3>
              <Button
                onClick={clearSyncErrors}
                className="text-sm py-1 px-2"
                variant="secondary"
              >
                Clear All
              </Button>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {syncErrors.map((error, index) => (
                <div key={index} className="p-3 bg-red-50 border border-red-200 rounded text-sm">
                  <div className="font-medium text-red-800">{error.action || 'Sync Error'}</div>
                  <div className="text-red-700 mt-1">{error.error}</div>
                  <Button
                    onClick={() => handleRetryError(index)}
                    className="mt-2 text-xs py-1 px-2"
                    variant="outline"
                  >
                    Retry
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Conflict Resolution */}
        {stats.conflicts > 0 && (
          <div className="mb-6">
            <h3 className="font-medium text-yellow-600 mb-3">Data Conflicts</h3>
            <div className="space-y-3">
              {/* Placeholder for conflict resolution UI */}
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                <div className="text-sm text-yellow-800">
                  {stats.conflicts} data conflict{stats.conflicts > 1 ? 's' : ''} detected.
                  Conflicts will be resolved automatically using server data.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Offline Data Summary */}
        <div className="mb-6">
          <h3 className="font-medium mb-3">Offline Data Summary</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Cached Records:</span>
              <span className="ml-2 font-medium">{Object.keys(offlineData).length}</span>
            </div>
            <div>
              <span className="text-gray-600">Storage Used:</span>
              <span className="ml-2 font-medium">~{(JSON.stringify(offlineData).length / 1024).toFixed(1)} KB</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3">
          <Button onClick={onClose} variant="secondary">
            Close
          </Button>
          {syncStatus !== 'syncing' && pendingActions > 0 && (
            <Button onClick={handleManualSync} loading={syncStatus === 'syncing'}>
              Sync Now
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}