import React, { useEffect, useState } from 'react';
import useApi from '../../hooks/useApi';
import Button from '../common/Button';
import TimerDisplay from '../common/TimerDisplay';
import useTimer from '../../hooks/useTimer';
import ProgressBar from '../common/ProgressBar';
import { showToast } from '../../utils/helpers';

export default function BreakManager({ logId }) {
  const api = useApi();
  const [breakStartedAt, setBreakStartedAt] = useState(null);
  const [breakEndedAt, setBreakEndedAt] = useState(null);
  const [loading, setLoading] = useState(false);
  const limitMinutes = 30;

  const timer = useTimer({ initial: 0, interval: 1000, autoStart: false });

  // keep timer in sync with break start/end
  useEffect(() => {
    if (breakStartedAt && !breakEndedAt) {
      // start or resume timer with elapsed since breakStartedAt
      const elapsed = Date.now() - new Date(breakStartedAt).getTime();
      timer.reset(elapsed);
      timer.start();
    } else {
      timer.pause();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breakStartedAt, breakEndedAt]);

  // auto-end when exceeding limit
  useEffect(() => {
    const minutes = Math.floor(timer.elapsed / 60000);
    if (breakStartedAt && !breakEndedAt && minutes >= limitMinutes) {
      // automatically end break
      (async () => {
        try { await end(); }
        catch (e) { /* ignore */ }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer.elapsed, breakStartedAt, breakEndedAt]);

  const start = async () => {
    if (!logId) return;
    setLoading(true);
    try {
      const res = await api.post(`/hourly-logs/${logId}/break/start`, {});
      setBreakStartedAt(new Date(res.data.breakStartedAt || Date.now()));
      setBreakEndedAt(null);
      showToast('Break started', 'success');
    } catch (err) {
      const serverMsg = err?.response?.data?.message || err?.response?.data?.error;
      const msg = serverMsg || err?.message || 'Failed to start break';
      showToast(msg, 'error');
      // try to re-sync current log from server to update UI correctness
      try {
        const r = await api.get(`/hourly-logs/${logId}`);
        const log = r?.data;
        if (log) {
          setBreakStartedAt(log.breakStartedAt ? new Date(log.breakStartedAt) : null);
          setBreakEndedAt(log.breakEndedAt ? new Date(log.breakEndedAt) : null);
        }
      } catch (e) { /* ignore re-sync errors */ }
    } finally {
      setLoading(false);
    }
  };

  const end = async () => {
    if (!logId) return;
    setLoading(true);
    try {
      const res = await api.put(`/hourly-logs/${logId}/break/end`, {});
      setBreakEndedAt(new Date(res.data.breakEndedAt || Date.now()));
      timer.pause();
      showToast('Break ended', 'success');
    } catch (err) {
      const serverMsg = err?.response?.data?.message || err?.response?.data?.error;
      const msg = serverMsg || err?.message || 'Failed to end break';
      showToast(msg, 'error');
      // try to re-sync current log from server to update UI correctness
      try {
        const r = await api.get(`/hourly-logs/${logId}`);
        const log = r?.data;
        if (log) {
          setBreakStartedAt(log.breakStartedAt ? new Date(log.breakStartedAt) : null);
          setBreakEndedAt(log.breakEndedAt ? new Date(log.breakEndedAt) : null);
          // pause timer if break ended is present
          if (log.breakEndedAt) timer.pause();
        }
      } catch (e) { /* ignore re-sync errors */ }
    } finally {
      setLoading(false);
    }
  };

  const duration = breakStartedAt ? Math.round((new Date(breakEndedAt || Date.now()) - new Date(breakStartedAt)) / 60000) : 0;
  const percent = Math.min(100, Math.round((duration / limitMinutes) * 100));
  const approaching = duration >= Math.max(0, limitMinutes - 5) && duration < limitMinutes;

  return (
    <div className="p-4 border rounded bg-white">
      <h4 className="font-semibold">Break Manager</h4>
      <div className="mt-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm">Break Duration</div>
            <div className="font-medium">{duration} min</div>
          </div>
          <div>
            <TimerDisplay startTime={breakStartedAt} paused={!!breakEndedAt} />
          </div>
        </div>

        <div className="mt-3">
          <ProgressBar percent={percent} />
        </div>

        <div className="mt-3 flex space-x-2">
          <Button onClick={start} disabled={!!breakStartedAt && !breakEndedAt || loading}>Start Break</Button>
          <Button variant="secondary" onClick={end} disabled={!breakStartedAt || !!breakEndedAt || loading}>End Break</Button>
        </div>
        {approaching && <div className="text-sm text-yellow-600 mt-2">Approaching 30 minute limit</div>}
        {duration > limitMinutes && <div className="text-sm text-red-600 mt-2">Break exceeded 30 minutes - this may invalidate eligibility</div>}
      </div>
    </div>
  );
}
