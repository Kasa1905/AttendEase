import React from 'react';
import Button from './Button';
import useNotifications from '../../hooks/useNotifications';

export default function NotificationCenter() {
  const { notifications, unread, page, pageSize, total, markRead, markAll, deleteNotification, loadPage } = useNotifications();

  return (
    <div className="relative">
      <Button>🔔 {unread>0 && <span className="ml-2 text-sm">{unread}</span>}</Button>
      <div className="absolute right-0 mt-2 w-96 bg-white border rounded shadow p-2">
        <div className="flex items-center justify-between">
          <div className="font-semibold">Notifications</div>
          <div className="space-x-2">
            <button className="text-sm text-blue-600" onClick={() => markAll()}>Mark all read</button>
          </div>
        </div>
        <ul className="mt-2 space-y-2 max-h-64 overflow-auto">
          {notifications.map(n => (
            <li key={n.id} className="p-2 border-b flex items-start justify-between">
              <div>
                <div className="font-medium">{n.title} {n.isRead ? null : <span className="text-xs text-red-500">•</span>}</div>
                <div className="text-sm text-gray-600">{n.message}</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {!n.isRead && <button className="text-xs text-green-600" onClick={() => markRead(n.id)}>Mark</button>}
                <button className="text-xs text-red-600" onClick={() => deleteNotification(n.id)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex items-center justify-between text-sm">
          <div>Page {page} / {Math.max(1, Math.ceil((total||0)/pageSize))}</div>
          <div className="space-x-2">
            <button disabled={page<=1} onClick={() => loadPage(page-1)} className="px-2 py-1 border rounded">Prev</button>
            <button disabled={page*pageSize>= (total||0)} onClick={() => loadPage(page+1)} className="px-2 py-1 border rounded">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
