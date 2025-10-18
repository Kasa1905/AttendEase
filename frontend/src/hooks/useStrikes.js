import { useEffect, useState } from 'react';
import useApi from './useApi';
import { useSocket } from '../contexts/SocketContext';

export default function useStrikes() {
  const api = useApi();
  const { socket } = useSocket();
  const [strikes, setStrikes] = useState([]);
  const [activeStrikeCount, setActiveStrikeCount] = useState(0);
  const [statistics, setStatistics] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load user's strikes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get('/strikes/me', { params: { page, pageSize } });
        if (!cancelled) {
          const data = res.data?.data || res.data || [];
          setStrikes(data);
          setTotal(res.data?.total || 0);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [api, page, pageSize]);

  // Load active strike count
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/strikes/me/active-count');
        if (!cancelled) {
          setActiveStrikeCount(res.data?.count || 0);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [api]);

  // Listen for real-time strike updates
  useEffect(() => {
    if (!socket) return;
    const handler = (strike) => {
      setStrikes(s => [strike, ...s]);
      setActiveStrikeCount(c => c + 1);
      setTotal(t => t + 1);
    };
    socket.on('strike', handler);
    return () => { socket.off('strike', handler); };
  }, [socket]);

  const resolveStrike = async (strikeId, resolutionNotes) => {
    setLoading(true);
    setError(null);
    try {
      await api.put(`/strikes/${strikeId}/resolve`, { resolutionNotes });
      setStrikes(s => s.map(strike =>
        strike.id === strikeId
          ? { ...strike, status: 'resolved', resolutionNotes, resolvedAt: new Date().toISOString() }
          : strike
      ));
      setActiveStrikeCount(c => Math.max(0, c - 1));
    } catch (e) {
      setError(e);
      console.error('resolveStrike', e);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const loadPage = async (p) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/strikes/me', { params: { page: p, pageSize } });
      const data = res.data?.data || res.data || [];
      setStrikes(data);
      setTotal(res.data?.total || 0);
      setPage(p);
    } catch (e) {
      setError(e);
      console.error('loadPage', e);
    } finally {
      setLoading(false);
    }
  };

  const refreshActiveCount = async () => {
    try {
      const res = await api.get('/strikes/me/active-count');
      setActiveStrikeCount(res.data?.count || 0);
    } catch (e) {
      setError(e);
      console.error('refreshActiveCount', e);
    }
  };

  return {
    strikes,
    activeStrikeCount,
    statistics,
    page,
    pageSize,
    total,
    loading,
    error,
    resolveStrike,
    loadPage,
    refreshActiveCount
  };
}