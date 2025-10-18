import React, { useEffect, useState } from 'react';
import useApi from '../../hooks/useApi';
import Button from '../common/Button';
import { formatDate, formatRequestType, formatRequestReason } from '../../utils/helpers';

export default function RequestApprovalInterface() {
  const api = useApi();
  const [requests, setRequests] = useState([]);
  const [selected, setSelected] = useState(new Set());

  useEffect(() => { let c=false; (async () => { try { const r=await api.get('/leave-requests/pending'); if(!c) setRequests(r.data); } catch(e) {} })(); return ()=>{c=true}; }, [api]);

  const approve = async (id) => { try { await api.put(`/leave-requests/${id}/approve`); setRequests(s=>s.filter(x=>x.id!==id)); } catch (e) { console.error(e); } };
  const reject = async (id) => { const reason = window.prompt('Reason for rejection'); if(!reason) return; try { await api.put(`/leave-requests/${id}/reject`, { rejectionReason: reason }); setRequests(s=>s.filter(x=>x.id!==id)); } catch (e) { console.error(e); } };
  const bulkApprove = async () => { const ids = Array.from(selected); if(!ids.length) return; try { await api.post('/leave-requests/bulk-approve', { ids }); setRequests(s=>s.filter(x=>!selected.has(x.id))); setSelected(new Set()); } catch(e) { console.error(e); } };

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = (checked) => {
    if (checked) setSelected(new Set(requests.map(r=>r.id))); else setSelected(new Set());
  };

  return (
    <div className="p-4 border rounded bg-white">
      <h4 className="font-semibold">Pending Requests</h4>
      <div className="mt-3">
        <div className="mb-2"><Button onClick={bulkApprove} disabled={selected.size===0}>Approve Selected</Button></div>
        <ul className="space-y-2">
          <li className="p-2 border-b">
            <label className="inline-flex items-center"><input type="checkbox" onChange={(e)=>selectAll(e.target.checked)} /> <span className="ml-2 text-sm">Select all</span></label>
          </li>
          {requests.map(r=> (
            <li key={r.id} className="p-3 border rounded flex justify-between items-start">
              <div className="mr-3">
                <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
              </div>
              <div>
                <div className="text-sm text-gray-500">{[r.user?.firstName, r.user?.lastName].filter(Boolean).join(' ') || r.user?.email} • {formatDate(r.requestDate)} • {formatRequestType(r.requestType)}</div>
                <div className="font-medium">{formatRequestReason(r.reason)}</div>
              </div>
              <div className="text-right">
                <div className="flex flex-col items-end">
                  <div className="mb-2"><Button onClick={() => approve(r.id)}>Approve</Button></div>
                  <div><Button variant="secondary" onClick={() => reject(r.id)}>Reject</Button></div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
