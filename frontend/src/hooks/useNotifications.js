import { useEffect, useState } from 'react';
import useApi from './useApi';
import { useSocket } from '../contexts/SocketContext';

export default function useNotifications() {
  const api = useApi();
  const { socket } = useSocket();
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/notifications', { params: { page, pageSize } });
        if (!cancelled) {
          const data = res.data?.data || res.data || [];
          setNotifications(data);
          setTotal(res.data?.total || 0);
          setUnread(res.data?.total ? res.data.data?.filter(d=>!d.isRead).length || data.filter(d=>!d.isRead).length : data.filter(d=>!d.isRead).length);
        }
      } catch (e) { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [api]);

  useEffect(() => {
    if (!socket) return;
    const handler = (n) => { setNotifications(s => [n, ...s]); setUnread(u => u + 1); setTotal(t=>t+1); };
    socket.on('notification', handler);
    return () => { socket.off('notification', handler); };
  }, [socket]);

  const markRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(s => s.map(n => n.id === id ? { ...n, isRead: true } : n));
      setUnread(u => Math.max(0, u - 1));
    } catch (e) { console.error('markRead', e); }
  };

  const markAll = async () => {
    try {
      await api.put(`/notifications/read-all`);
      setNotifications(s => s.map(n => ({ ...n, isRead: true })));
      setUnread(0);
    } catch (e) { console.error('markAll', e); }
  };

  const deleteNotification = async (id) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications(s => s.filter(n => n.id !== id));
      setTotal(t => Math.max(0, t - 1));
    } catch (e) { console.error('deleteNotification', e); }
  };

  const loadPage = async (p) => {
    try {
      const res = await api.get('/notifications', { params: { page: p, pageSize } });
      const data = res.data?.data || res.data || [];
      setNotifications(data);
      setTotal(res.data?.total || 0);
      setPage(p);
      setUnread(res.data?.total ? res.data.data?.filter(d=>!d.isRead).length || data.filter(d=>!d.isRead).length : data.filter(d=>!d.isRead).length);
    } catch (e) { console.error('loadPage', e); }
  };

  return { notifications, unread, page, pageSize, total, markRead, markAll, deleteNotification, loadPage };
}
