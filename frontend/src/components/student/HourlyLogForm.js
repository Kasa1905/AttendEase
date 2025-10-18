import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import useApi from '../../hooks/useApi';
import { useOffline } from '../../contexts/OfflineContext.js';
import Button from '../common/Button';
import Input from '../common/Input';
import { validateHourlyLogTiming } from '../../utils/helpers';
import { getNextLogDueTime } from '../../utils/timeUtils';
import { showToast } from '../../utils/helpers';
import { saveOfflineData } from '../../utils/offlineStorage';

export default function HourlyLogForm({ session, lastLog }) {
  const api = useApi();
  const { isOnline, queueOfflineAction, loadOfflineData } = useOffline();
  const { register, handleSubmit, reset, watch, setValue } = useForm();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [syncStatus, setSyncStatus] = useState(null);

  const draftKey = session ? `hourlyLogDraft:${session.id}` : null;

  // load draft when session changes
  useEffect(() => {
    if (!session) { reset(); setMessage(null); return; }
    const raw = draftKey ? localStorage.getItem(draftKey) : null;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.previousHourWork) setValue('previousHourWork', parsed.previousHourWork);
        if (parsed.nextHourPlan) setValue('nextHourPlan', parsed.nextHourPlan);
      } catch (e) { /* ignore malformed draft */ }
    } else {
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // autosave draft on changes
  const watchedPrev = watch('previousHourWork');
  const watchedNext = watch('nextHourPlan');
  useEffect(() => {
    if (!draftKey) return;
    const toSave = { previousHourWork: watchedPrev || '', nextHourPlan: watchedNext || '' };
    try { localStorage.setItem(draftKey, JSON.stringify(toSave)); } catch (e) { /* ignore storage errors */ }
  }, [watchedPrev, watchedNext, draftKey]);

  const onSubmit = async (vals) => {
    if (!session) return setMessage('No active session');
    setLoading(true); setMessage(null);

    // timing validation
    const sessionStart = session.startTime || session.startedAt;
    const isValid = validateHourlyLogTiming(sessionStart, lastLog);
    if (!isValid) {
      setLoading(false);
      setMessage('Cannot submit now — this log is outside the allowed timing window.');
      return;
    }

    try {
      const body = {
        sessionId: session.id,
        previousHourWork: vals.previousHourWork,
        nextHourPlan: vals.nextHourPlan
      };

      if (!isOnline) {
        // Offline mode - queue for later sync
        const actionId = await queueOfflineAction('submit_hourly_log', body, 1);

        // Optimistic update
        const optimisticLog = {
          id: `offline_${Date.now()}`,
          sessionId: session.id,
          previousHourWork: vals.previousHourWork,
          nextHourPlan: vals.nextHourPlan,
          submittedAt: new Date().toISOString(),
          _offline: true,
          _actionId: actionId
        };

        // Save to offline storage
        saveOfflineData(`hourly_log:${optimisticLog.id}`, optimisticLog, Date.now(), { type: 'hourly_log' });

        // Refresh offline data in context
        loadOfflineData();

        setMessage('Log saved (offline)');
        setSyncStatus('pending');
        showToast('Hourly log saved (offline)', 'success');

        // Clear draft and form
        if (draftKey) localStorage.removeItem(draftKey);
        reset();
      } else {
        // Online mode - normal API call
        const res = await api.post('/hourly-logs', body);
        setMessage('Log saved');
        setSyncStatus('synced');
        showToast('Hourly log saved', 'success');

        // Clear draft
        if (draftKey) localStorage.removeItem(draftKey);
        reset();
      }
    } catch (err) {
      // Handle offline fallback
      if (!isOnline && (err?.code === 'ERR_NETWORK' || !navigator.onLine)) {
        // Queue for later sync
        const actionId = await queueOfflineAction('submit_hourly_log', {
          sessionId: session.id,
          previousHourWork: vals.previousHourWork,
          nextHourPlan: vals.nextHourPlan
        }, 1);

        // Optimistic update
        const optimisticLog = {
          id: `offline_${Date.now()}`,
          sessionId: session.id,
          previousHourWork: vals.previousHourWork,
          nextHourPlan: vals.nextHourPlan,
          submittedAt: new Date().toISOString(),
          _offline: true,
          _actionId: actionId
        };

        // Save to offline storage
        saveOfflineData(`hourly_log:${optimisticLog.id}`, optimisticLog, Date.now(), { type: 'hourly_log' });

        // Refresh offline data in context
        loadOfflineData();

        setMessage('Log saved (offline)');
        setSyncStatus('pending');
        showToast('Hourly log saved (offline)', 'success');

        // Clear draft and form
        if (draftKey) localStorage.removeItem(draftKey);
        reset();
      } else {
        // Online error
        const serverMsg = err?.response?.data?.message || err?.response?.data?.error;
        const msg = serverMsg || err?.message || 'Failed to save log';
        setMessage(msg);
        setSyncStatus('error');
        showToast(msg, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const sessionStart = session ? (session.startTime || session.startedAt) : null;
  const nextDue = getNextLogDueTime(sessionStart, lastLog ? [lastLog] : []);

  const getSyncStatusBadge = () => {
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
        <h4 className="font-semibold flex items-center">
          Hourly Log
          {getSyncStatusBadge()}
        </h4>
        {!isOnline && (
          <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded">
            Offline Mode
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div>
          <label className="text-sm">Previous Hour Work Done</label>
          <textarea
            {...register('previousHourWork', { required: true, minLength: 5 })}
            className="w-full border rounded p-2"
            rows={3}
            placeholder={isOnline ? '' : 'Work completed in the previous hour...'}
          />
        </div>
        <div>
          <label className="text-sm">Next Hour Plan</label>
          <textarea
            {...register('nextHourPlan', { required: true, minLength: 5 })}
            className="w-full border rounded p-2"
            rows={2}
            placeholder={isOnline ? '' : 'Plan for the next hour...'}
          />
        </div>

        {nextDue && (
          <div className="text-sm text-gray-500">
            Next log due: {new Date(nextDue).toLocaleTimeString()}
          </div>
        )}

        <div className="flex space-x-2">
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving...' : (isOnline ? 'Save Log' : 'Save (Offline)')}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              reset();
              if (draftKey) localStorage.removeItem(draftKey);
            }}
          >
            Clear
          </Button>
        </div>

        {message && (
          <div className={`text-sm ${syncStatus === 'error' ? 'text-red-700' : 'text-gray-700'}`}>
            {message}
          </div>
        )}

        {!isOnline && (
          <div className="text-sm text-blue-600 bg-blue-50 p-2 rounded">
            You're offline. Log will be synced when connection is restored.
          </div>
        )}
      </form>
    </div>
  );
}
