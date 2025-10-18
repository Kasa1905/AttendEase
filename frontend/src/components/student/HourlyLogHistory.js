import React, { useEffect, useState } from 'react';
import useApi from '../../hooks/useApi';
import { showToast } from '../../utils/helpers';

export default function HourlyLogHistory({ sessionId }) {
  const api = useApi();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await api.get(`/hourly-logs/session/${sessionId}`);
        if (!cancelled) setLogs(res.data);
      } catch (err) {
        const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to load logs';
        showToast(msg, 'error');
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [api, sessionId]);

  return (
    <div className="p-4 border rounded bg-white">
      <h4 className="font-semibold">Hourly Log History</h4>
      {loading && <div className="text-sm text-gray-500">Loading...</div>}
      {!loading && (!logs || logs.length === 0) && <div className="text-sm text-gray-500">No logs</div>}
      <ul className="space-y-2 mt-3">
        {logs.map(l => (
          <li key={l.id} className="p-2 border rounded">
            <div className="text-xs text-gray-500">{new Date(l.createdAt).toLocaleString()}</div>
            <div className="font-medium">{l.previousHourWork}</div>
            <div className="text-sm text-gray-600">Plan: {l.nextHourPlan}</div>
            {l.breakStartedAt && <div className="text-sm text-yellow-600">Break started: {new Date(l.breakStartedAt).toLocaleTimeString()}</div>}
            {l.breakEndedAt && <div className="text-sm text-red-600">Break ended: {new Date(l.breakEndedAt).toLocaleTimeString()}</div>}
          </li>
        ))}
      </ul>
    </div>
  );
}
