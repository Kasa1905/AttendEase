import { useEffect, useState } from 'react';
import useApi from './useApi';

export default function useDutySession() {
  const api = useApi();
  const [session, setSession] = useState(null);
  const [currentLog, setCurrentLog] = useState(null);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const res = await api.get('/duty-sessions/current');
      const s = res.data;
      setSession(s);
      // fetch latest hourly log for the session if session exists
      if (s && s.id) {
        try {
          const logsRes = await api.get(`/hourly-logs/session/${s.id}?limit=1&sort=desc`);
          const latest = (logsRes?.data && logsRes.data.length) ? logsRes.data[0] : null;
          setCurrentLog(latest);
        } catch (err) {
          setCurrentLog(null);
        }
      } else {
        setCurrentLog(null);
      }
    } catch (err) {
      // ignore - keep existing state
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 60000);
    return () => clearInterval(t);
  }, []);

  const start = async () => {
    const res = await api.post('/duty-sessions/start');
    setSession(res.data);
    // refresh logs after start
    await refresh();
    return res.data;
  };

  const end = async (id) => {
    const res = await api.put(`/duty-sessions/${id}/end`);
    setSession(res.data.session || null);
    // refresh logs after end
    await refresh();
    return res.data;
  };

  return { session, currentLog, loading, refresh, start, end };
}
