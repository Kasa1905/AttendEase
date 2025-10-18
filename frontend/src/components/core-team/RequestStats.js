import React, { useEffect, useState } from 'react';
import useApi from '../../hooks/useApi';
import StatusCard from '../common/StatusCard';

export default function RequestStats() {
  const api = useApi();
  const [stats, setStats] = useState(null);

  useEffect(()=>{ let c=false; (async ()=>{ try { const r=await api.get('/leave-requests/stats'); if(!c) setStats(r.data); } catch(e){} })(); return ()=>{c=true}; }, [api]);

  return (
    <div className="grid grid-cols-3 gap-4">
      <StatusCard title="Total Requests" value={stats?.total ?? '-'} />
      <StatusCard title="Pending" value={stats?.pending ?? '-'} />
      <StatusCard title="Approved" value={stats?.approved ?? '-'} />
    </div>
  );
}
