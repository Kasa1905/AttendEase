import React, { useEffect, useState } from 'react';
import useApi from '../../hooks/useApi';
import useLeaveRequests from '../../hooks/useLeaveRequests';
import { formatRequestReason, getRequestStatusColor, formatRequestType, formatDate, getDeadlineStatus } from '../../utils/helpers';
import Button from '../common/Button';

export default function MyRequests() {
  const api = useApi();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editPayload, setEditPayload] = useState({ requestDate: '', reason: '' });
  const lr = useLeaveRequests();

  useEffect(() => { let c=false; (async () => { setLoading(true); try { const r = await api.get('/leave-requests/my'); if(!c) setRequests(r.data); } catch(e) {} finally { if(!c) setLoading(false); } })(); return () => { c=true; } }, [api]);

  const del = async (id) => { try { await api.del(`/leave-requests/${id}`); setRequests(s => s.filter(x => x.id !== id)); } catch (e) { /* show toast elsewhere */ } };

  const startEdit = (r) => { setEditingId(r.id); setEditPayload({ requestDate: r.requestDate, reason: r.reason }); };

  const cancelEdit = () => { setEditingId(null); setEditPayload({ requestDate: '', reason: '' }); };

  const saveEdit = async (id) => {
    try {
      const payload = { requestDate: editPayload.requestDate, reason: editPayload.reason };
      const res = await lr.updateRequest(id, payload);
      setRequests(s => s.map(x => x.id === id ? { ...x, ...res } : x));
      cancelEdit();
    } catch (e) { /* handled by hook */ }
  };

  return (
    <div className="p-4 border rounded bg-white">
      <h4 className="font-semibold">My Requests</h4>
      {loading && <div className="text-sm text-gray-500">Loading...</div>}
      {!loading && requests.length === 0 && <div className="text-sm text-gray-500">No requests</div>}
      <ul className="mt-3 space-y-2">
        {requests.map(r => (
          <li key={r.id} className="p-3 border rounded">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-sm text-gray-500">{formatDate(r.requestDate)} • {formatRequestType(r.requestType)}</div>
                <div className="font-medium">{formatRequestReason(r.reason)}</div>
                {r.rejectionReason && <div className="text-sm text-red-600">Rejected: {r.rejectionReason}</div>}
                {editingId === r.id && (
                  <div className="mt-2 p-2 border rounded bg-gray-50">
                    <label className="block text-sm">Date
                      <input className="mt-1 p-1 border rounded w-full" type="date" value={editPayload.requestDate} onChange={(e)=>setEditPayload(p=>({...p, requestDate: e.target.value}))} />
                    </label>
                    <label className="block text-sm mt-2">Reason
                      <textarea className="mt-1 p-1 border rounded w-full" value={editPayload.reason} onChange={(e)=>setEditPayload(p=>({...p, reason: e.target.value}))} minLength={10} />
                    </label>
                    <div className="mt-2 flex gap-2">
                      <Button onClick={()=>saveEdit(r.id)}>Save</Button>
                      <Button variant="secondary" onClick={cancelEdit}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className={`${getRequestStatusColor(r.status)} font-semibold`}>{r.status}</div>
                {r.status === 'pending' && <div className="mt-2 flex flex-col gap-2">
                  <div><Button variant="secondary" onClick={() => del(r.id)}>Delete</Button></div>
                  <div><Button onClick={() => startEdit(r)}>Edit</Button></div>
                </div>}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
