import React, { useEffect, useState } from 'react';
import useApi from '../../hooks/useApi';
import { useOffline } from '../../contexts/OfflineContext.js';
import { showToast } from '../../utils/helpers';
import { saveOfflineData } from '../../utils/offlineStorage';
import { offlineAPI } from '../../utils/api';
import Button from '../common/Button';

export default function AttendanceSelector({ onMarked }) {
  const api = useApi();
  const { isOnline, queueOfflineAction, loadOfflineData } = useOffline();
  const [serverStatus, setServerStatus] = useState(null); // what the server says has been recorded
  const [selectedChoice, setSelectedChoice] = useState(null); // local UI choice before submit
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [offlineMarked, setOfflineMarked] = useState(false); // track offline attendance
  const [syncStatus, setSyncStatus] = useState(null); // 'synced', 'pending', 'error'

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const today = new Date().toISOString().slice(0, 10);
        const res = await offlineAPI.get(`/attendance/date/${today}`, {}, {
          offlineFallback: true,
          cacheOffline: true
        });
        
        if (!cancelled) {
          setServerStatus(res?.data?.[0] || null);
          if (res._offline) {
            setSyncStatus('cached');
          }
        }
      } catch (err) {
        // ignore errors - non-fatal for dashboard load
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const mark = async () => {
    if (serverStatus && !offlineMarked) return; // already marked on server
    if (!selectedChoice) return setError('Please select an attendance status');
    setLoading(true);
    setError(null);

    try {
      const body = { status: selectedChoice };

      if (!isOnline) {
        // Offline mode - queue for later sync
        const actionId = await queueOfflineAction('mark_attendance', body, 2); // High priority

        // Optimistic update
        const optimisticRecord = {
          id: `offline_${Date.now()}`,
          status: selectedChoice,
          date: new Date().toISOString().slice(0, 10),
          _offline: true,
          _actionId: actionId
        };

        // Save to offline storage
        const today = new Date().toISOString().slice(0, 10);
        saveOfflineData(`attendance:${today}`, optimisticRecord, Date.now(), { type: 'attendance' });

        // Refresh offline data in context
        loadOfflineData();

        setServerStatus(optimisticRecord);
        setOfflineMarked(true);
        setSyncStatus('pending');
        setSelectedChoice(null);

        showToast('Attendance marked (offline)', 'success');
        if (onMarked) onMarked(optimisticRecord);
      } else {
        // Online mode - normal API call
        const res = await api.post('/attendance', body);
        setServerStatus(res.data);
        setSelectedChoice(null);
        setSyncStatus('synced');
        showToast('Attendance marked', 'success');
        if (onMarked) onMarked(res.data);
      }
    } catch (err) {
      // Handle offline fallback
      if (!isOnline && (err?.code === 'ERR_NETWORK' || !navigator.onLine)) {
        // Queue for later sync
        const actionId = await queueOfflineAction('mark_attendance', { status: selectedChoice }, 2);

        const optimisticRecord = {
          id: `offline_${Date.now()}`,
          status: selectedChoice,
          date: new Date().toISOString().slice(0, 10),
          _offline: true,
          _actionId: actionId
        };

        // Save to offline storage
        const today = new Date().toISOString().slice(0, 10);
        saveOfflineData(`attendance:${today}`, optimisticRecord, Date.now(), { type: 'attendance' });

        // Refresh offline data in context
        loadOfflineData();

        setServerStatus(optimisticRecord);
        setOfflineMarked(true);
        setSyncStatus('pending');
        setSelectedChoice(null);

        showToast('Attendance marked (offline)', 'success');
        if (onMarked) onMarked(optimisticRecord);
      } else {
        // Online error
        const serverMsg = err?.response?.data?.error || err?.response?.data?.message;
        setError(serverMsg || err?.message || 'Failed to mark attendance');
        showToast(serverMsg || err?.message || 'Failed to mark attendance', 'error');
        setSyncStatus('error');
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatusDisplay = () => {
    if (!serverStatus) return null;

    const isOfflineRecord = serverStatus._offline;
    const statusText = serverStatus.status;

    return (
      <div className="flex items-center space-x-3">
        <div className="text-sm">Status:</div>
        <div className="font-medium flex items-center space-x-2">
          <span>{statusText}</span>
          {isOfflineRecord && (
            <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">
              Offline
            </span>
          )}
          {syncStatus === 'pending' && (
            <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
              Pending Sync
            </span>
          )}
          {syncStatus === 'error' && (
            <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded">
              Sync Error
            </span>
          )}
          {syncStatus === 'synced' && (
            <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
              Synced
            </span>
          )}
          {syncStatus === 'cached' && (
            <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded">
              Cached
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 border rounded-md bg-white">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold">Today&apos;s Attendance</h3>
        {!isOnline && (
          <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded">
            Offline Mode
          </span>
        )}
      </div>

      {loading && <p className="text-sm text-gray-500">Loading...</p>}
      {!loading && (
        <div className="mt-3">
          {serverStatus ? (
            getStatusDisplay()
          ) : (
            <div className="space-y-2">
              <div className="flex items-center space-x-3">
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="attendance"
                    checked={selectedChoice === 'present_in_class'}
                    onChange={() => setSelectedChoice('present_in_class')}
                  />
                  <span>Present in Class</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="attendance"
                    checked={selectedChoice === 'on_club_duty'}
                    onChange={() => setSelectedChoice('on_club_duty')}
                  />
                  <span>On Club Duty</span>
                </label>
              </div>
              <div className="flex space-x-2">
                <Button onClick={mark} disabled={!selectedChoice || loading}>
                  {isOnline ? 'Mark Attendance' : 'Mark (Offline)'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSelectedChoice(null);
                    setError(null);
                  }}
                >
                  Reset
                </Button>
              </div>
              {error && <div className="text-sm text-red-600">{error}</div>}
              {!isOnline && (
                <div className="text-sm text-blue-600 bg-blue-50 p-2 rounded">
                  You're offline. Attendance will be synced when connection is restored.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
