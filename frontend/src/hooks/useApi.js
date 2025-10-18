import api from '../utils/api';
import { useState, useCallback } from 'react';

export default function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const wrap = useCallback(async (fn) => {
    setLoading(true); setError(null);
    try { const res = await fn(); setLoading(false); return res; } catch (e) { setError(e); setLoading(false); throw e; }
  }, []);

  const get = (url, cfg) => wrap(() => api.get(url, cfg));
  const post = (url, data, cfg) => wrap(() => api.post(url, data, cfg));
  const put = (url, data, cfg) => wrap(() => api.put(url, data, cfg));
  const del = (url, cfg) => wrap(() => api.delete(url, cfg));

  return { get, post, put, del, loading, error };
}
