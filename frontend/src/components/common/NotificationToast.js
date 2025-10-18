import React, { useEffect } from 'react';
import { useSocket } from '../../contexts/SocketContext';
import { showToast } from '../../utils/helpers';

export default function NotificationToast() {
  const { socket } = useSocket();
  useEffect(() => {
    if (!socket) return;
    const handler = (n) => { showToast(n.title + ': ' + n.message, 'info', 5000); };
    socket.on('notification', handler);
    return () => { socket.off('notification', handler); };
  }, [socket]);
  return null;
}
