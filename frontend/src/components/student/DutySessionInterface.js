import React, { useState, useEffect } from 'react';
import Button from '../common/Button';
import { showToast } from '../../utils/helpers';
import TimerDisplay from '../common/TimerDisplay';
import ProgressBar from '../common/ProgressBar';
import BreakManager from './BreakManager';
import { calculateSessionProgress } from '../../utils/timeUtils';
import { useOffline } from '../../contexts/OfflineContext.js';
import { saveOfflineData } from '../../utils/offlineStorage';

export default function DutySessionInterface({ session, currentLog, loading, canStartSession = false, onStart, onEnd }) {
  const { isOnline, queueOfflineAction, loadOfflineData } = useOffline();
  const [error, setError] = useState(null);
  const [offlineSession, setOfflineSession] = useState(null);
  const [syncStatus, setSyncStatus] = useState(null);
  const [localTimer, setLocalTimer] = useState(null);

  // Handle offline timer persistence
  useEffect(() => {
    if (!isOnline && session) {
      // Start local timer for offline mode
      const startTime = session.startedAt || session.startTime;
      if (startTime) {
        setLocalTimer(new Date(startTime));
      }
    } else if (isOnline && localTimer) {
      // Clear local timer when back online
      setLocalTimer(null);
    }
  }, [isOnline, session]);

  // Update local timer every minute
  useEffect(() => {
    if (!localTimer) return;

    const interval = setInterval(() => {
      setLocalTimer(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [localTimer]);

  const handleStart = async () => {
    if (!window.confirm('Start a new duty session?')) return;
    setError(null);

    try {
      if (!isOnline) {
        // Offline mode - create optimistic session
        const optimisticSession = {
          id: `offline_${Date.now()}`,
          startedAt: new Date().toISOString(),
          status: 'active',
          _offline: true
        };

        // Queue for later sync
        await queueOfflineAction('start_duty_session', {
          startTime: optimisticSession.startedAt
        }, 1);

        // Save to offline storage
        saveOfflineData(`duty_session:${optimisticSession.id}`, optimisticSession, Date.now(), { type: 'duty_session' });

        // Refresh offline data in context
        loadOfflineData();

        setOfflineSession(optimisticSession);
        setSyncStatus('pending');
        setLocalTimer(new Date());

        showToast('Duty session started (offline)', 'success');
        if (onStart) onStart(optimisticSession);
      } else {
        // Online mode
        await onStart();
        setSyncStatus('synced');
        showToast('Duty session started', 'success');
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to start session';
      setError(msg);
      showToast(msg, 'error');
      setSyncStatus('error');
    }
  };

  const handleEnd = async () => {
    const currentSession = session || offlineSession;
    if (!currentSession) return;

    if (!window.confirm('End this duty session? This will finalize hourly logs.')) return;
    setError(null);

    try {
      const endTime = new Date().toISOString();

      if (!isOnline || currentSession._offline) {
        // Offline mode - queue end action
        await queueOfflineAction('end_duty_session', {
          sessionId: currentSession.id,
          endTime,
          _wasOffline: currentSession._offline
        }, 1);

        // Update optimistic session
        const endedSession = {
          ...currentSession,
          endedAt: endTime,
          status: 'completed',
          _offline: true
        };

        // Save to offline storage
        saveOfflineData(`duty_session:${endedSession.id}`, endedSession, Date.now(), { type: 'duty_session' });

        // Refresh offline data in context
        loadOfflineData();

        setOfflineSession(endedSession);
        setSyncStatus('pending');
        setLocalTimer(null);

        showToast('Duty session ended (offline)', 'success');
        if (onEnd) onEnd(endedSession);
      } else {
        // Online mode
        await onEnd();
        setSyncStatus('synced');
        showToast('Duty session ended', 'success');
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to end session';
      setError(msg);
      showToast(msg, 'error');
      setSyncStatus('error');
    }
  };

  // Use offline session if no online session
  const displaySession = session || offlineSession;
  const start = displaySession?.startedAt || displaySession?.startTime;

  let minutesSoFar = 0;
  if (start && !isNaN(Date.parse(start))) {
    const referenceTime = localTimer || new Date();
    minutesSoFar = Math.max(0, Math.round((referenceTime - new Date(start)) / 60000));
  }
  const percent = calculateSessionProgress(start, 120);

  const getSessionStatusBadge = () => {
    if (displaySession?._offline) {
      return (
        <span className="ml-2 px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">
          Offline
        </span>
      );
    }

    if (syncStatus === 'pending') {
      return (
        <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
          Pending Sync
        </span>
      );
    }

    if (syncStatus === 'error') {
      return (
        <span className="ml-2 px-2 py-1 text-xs bg-red-100 text-red-800 rounded">
          Sync Error
        </span>
      );
    }

    if (syncStatus === 'synced') {
      return (
        <span className="ml-2 px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
          Synced
        </span>
      );
    }

    return null;
  };

  return (
    <div className="p-4 border rounded-md bg-white">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold flex items-center">
          Duty Session
          {getSessionStatusBadge()}
        </h3>
        {!isOnline && (
          <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded">
            Offline Mode
          </span>
        )}
      </div>

      {loading && <p className="text-sm text-gray-500">Loading...</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}

      {!displaySession ? (
        <div className="mt-3">
          <p className="text-sm">No active session</p>
          <div className="mt-2">
            <Button onClick={handleStart} disabled={!canStartSession}>
              {isOnline ? 'Start Duty Session' : 'Start (Offline)'}
            </Button>
            {!canStartSession && (
              <div className="text-sm text-gray-500 mt-2">
                You must mark 'On Club Duty' attendance today to start a session.
              </div>
            )}
            {!isOnline && (
              <div className="text-sm text-blue-600 bg-blue-50 p-2 rounded mt-2">
                You're offline. Session will be synced when connection is restored.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm">Active since</div>
              <div className="font-medium">
                {start && !isNaN(Date.parse(start)) ? new Date(start).toLocaleString() : 'Unknown'}
                {displaySession._offline && ' (Offline)'}
              </div>
            </div>
            <div className="text-right">
              <TimerDisplay startTime={start} />
              <div className="mt-2">
                <Button onClick={handleEnd} variant="danger">
                  {isOnline ? 'End Session' : 'End (Offline)'}
                </Button>
              </div>
            </div>
          </div>

          <div>
            <ProgressBar percent={percent} />
            <div className="text-sm text-gray-500 mt-1">
              Progress toward 2 hour minimum: {minutesSoFar} min
              {localTimer && ' (Offline timer active)'}
            </div>
          </div>

          <div>
            <BreakManager logId={currentLog?.id} />
          </div>
        </div>
      )}
    </div>
  );
}
